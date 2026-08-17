package com.moser.server;

import java.sql.*;
import java.util.UUID;

public class Database {
    private static final String DB_PATH = "moser.db";
    private static Connection connection;

    public static void init() throws SQLException {
        connection = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
        connection.setAutoCommit(true);
        createTables();
        System.out.println("[Database] Initialized at " + DB_PATH);
    }

    private static void createTables() throws SQLException {
        Statement stmt = connection.createStatement();
        stmt.executeUpdate("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                hwid TEXT,
                token TEXT UNIQUE,
                expires DATETIME,
                plan TEXT DEFAULT 'free',
                created DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """);
        stmt.executeUpdate("""
            CREATE TABLE IF NOT EXISTS keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_code TEXT UNIQUE NOT NULL,
                used INTEGER DEFAULT 0,
                user_id INTEGER,
                plan TEXT DEFAULT 'month',
                expires DATETIME,
                created DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """);
        stmt.close();
    }

    public static boolean registerUser(String login, String passwordHash, String hwid) {
        try {
            String token = UUID.randomUUID().toString();
            PreparedStatement ps = connection.prepareStatement(
                "INSERT INTO users (login, password_hash, hwid, token) VALUES (?, ?, ?, ?)"
            );
            ps.setString(1, login);
            ps.setString(2, passwordHash);
            ps.setString(3, hwid);
            ps.setString(4, token);
            ps.executeUpdate();
            ps.close();
            return true;
        } catch (SQLException e) {
            System.err.println("[Database] Register error: " + e.getMessage());
            return false;
        }
    }

    public static User loginUser(String login, String passwordHash, String hwid) {
        try {
            PreparedStatement ps = connection.prepareStatement(
                "SELECT id, login, hwid, token, expires, plan FROM users WHERE login = ? AND password_hash = ?"
            );
            ps.setString(1, login);
            ps.setString(2, passwordHash);
            ResultSet rs = ps.executeQuery();

            if (rs.next()) {
                int id = rs.getInt("id");
                String storedHwid = rs.getString("hwid");
                String token = rs.getString("token");

                if (storedHwid != null && !storedHwid.isEmpty() && !storedHwid.equals(hwid)) {
                    ps.close();
                    rs.close();
                    return null;
                }

                PreparedStatement updateHwid = connection.prepareStatement(
                    "UPDATE users SET hwid = ? WHERE id = ?"
                );
                updateHwid.setString(1, hwid);
                updateHwid.setInt(2, id);
                updateHwid.executeUpdate();
                updateHwid.close();

                User user = new User();
                user.id = id;
                user.login = rs.getString("login");
                user.token = token;
                user.expires = rs.getString("expires");
                user.plan = rs.getString("plan");
                ps.close();
                rs.close();
                return user;
            }
            ps.close();
            rs.close();
        } catch (SQLException e) {
            System.err.println("[Database] Login error: " + e.getMessage());
        }
        return null;
    }

    public static User checkToken(String token, String hwid) {
        try {
            PreparedStatement ps = connection.prepareStatement(
                "SELECT id, login, hwid, expires, plan FROM users WHERE token = ?"
            );
            ps.setString(1, token);
            ResultSet rs = ps.executeQuery();

            if (rs.next()) {
                String storedHwid = rs.getString("hwid");
                if (storedHwid != null && !storedHwid.isEmpty() && !storedHwid.equals(hwid)) {
                    ps.close();
                    rs.close();
                    return null;
                }

                User user = new User();
                user.id = rs.getInt("id");
                user.login = rs.getString("login");
                user.expires = rs.getString("expires");
                user.plan = rs.getString("plan");
                ps.close();
                rs.close();
                return user;
            }
            ps.close();
            rs.close();
        } catch (SQLException e) {
            System.err.println("[Database] Check token error: " + e.getMessage());
        }
        return null;
    }

    public static User activateKey(String keyCode, String hwid) {
        try {
            PreparedStatement ps = connection.prepareStatement(
                "SELECT id, used, plan, expires FROM keys WHERE key_code = ?"
            );
            ps.setString(1, keyCode);
            ResultSet rs = ps.executeQuery();

            if (!rs.next()) {
                ps.close();
                rs.close();
                return null;
            }

            int keyId = rs.getInt("id");
            boolean used = rs.getInt("used") == 1;
            String plan = rs.getString("plan");

            if (used) {
                ps.close();
                rs.close();
                return null;
            }

            String token = UUID.randomUUID().toString();
            PreparedStatement insertUser = connection.prepareStatement(
                "INSERT INTO users (login, password_hash, hwid, token, plan) VALUES (?, ?, ?, ?, ?)"
            );
            insertUser.setString(1, "user_" + keyCode.substring(0, 8));
            insertUser.setString(2, "");
            insertUser.setString(3, hwid);
            insertUser.setString(4, token);
            insertUser.setString(5, plan);
            insertUser.executeUpdate();

            ResultSet generatedKeys = insertUser.getGeneratedKeys();
            int userId = -1;
            if (generatedKeys.next()) {
                userId = generatedKeys.getInt(1);
            }

            PreparedStatement updateKey = connection.prepareStatement(
                "UPDATE keys SET used = 1, user_id = ? WHERE id = ?"
            );
            updateKey.setInt(1, userId);
            updateKey.setInt(2, keyId);
            updateKey.executeUpdate();

            User user = new User();
            user.id = userId;
            user.login = "user_" + keyCode.substring(0, 8);
            user.token = token;
            user.plan = plan;

            insertUser.close();
            generatedKeys.close();
            updateKey.close();
            ps.close();
            rs.close();
            return user;
        } catch (SQLException e) {
            System.err.println("[Database] Activate key error: " + e.getMessage());
        }
        return null;
    }

    public static boolean generateKeys(String plan, int count) {
        try {
            PreparedStatement ps = connection.prepareStatement(
                "INSERT INTO keys (key_code, plan) VALUES (?, ?)"
            );
            for (int i = 0; i < count; i++) {
                String key = "MOSER-" + generateKeyPart() + "-" + generateKeyPart() + "-" + generateKeyPart() + "-" + generateKeyPart();
                ps.setString(1, key);
                ps.setString(2, plan);
                ps.addBatch();
            }
            ps.executeBatch();
            ps.close();
            return true;
        } catch (SQLException e) {
            System.err.println("[Database] Generate keys error: " + e.getMessage());
            return false;
        }
    }

    private static String generateKeyPart() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            sb.append(chars.charAt((int) (Math.random() * chars.length())));
        }
        return sb.toString();
    }

    public static void close() {
        try {
            if (connection != null && !connection.isClosed()) {
                connection.close();
            }
        } catch (SQLException e) {
            System.err.println("[Database] Close error: " + e.getMessage());
        }
    }

    public static class User {
        public int id;
        public String login;
        public String token;
        public String expires;
        public String plan;
    }
}
