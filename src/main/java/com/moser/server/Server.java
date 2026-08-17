package com.moser.server;

import at.favre.lib.crypto.bcrypt.BCrypt;
import io.javalin.Javalin;
import io.javalin.http.Context;
import java.io.File;

public class Server {
    private static final int PORT = 8080;

    public static void main(String[] args) {
        try {
            Database.init();
        } catch (Exception e) {
            System.err.println("[Server] Failed to initialize database: " + e.getMessage());
            return;
        }

        Javalin app = Javalin.create(config -> {
            config.showJavalinBanner = false;
        }).start(PORT);

        System.out.println("[Server] Moser Server started on port " + PORT);

        app.post("/api/auth/register", Server::handleRegister);
        app.post("/api/auth/login", Server::handleLogin);
        app.get("/api/auth/check", Server::handleCheck);
        app.post("/api/auth/activate", Server::handleActivate);
        app.get("/api/client/download/{filename}", Server::handleDownload);
        app.get("/api/client/latest", Server::handleLatest);
        app.post("/api/admin/keys/generate", Server::handleGenerateKeys);
    }

    private static void handleRegister(Context ctx) {
        try {
            var body = ctx.bodyAsClass(RegisterRequest.class);

            if (body.login == null || body.login.length() < 3) {
                ctx.json(new ErrorResponse("Логин минимум 3 символа"));
                return;
            }
            if (body.password == null || body.password.length() < 6) {
                ctx.json(new ErrorResponse("Пароль минимум 6 символов"));
                return;
            }
            if (body.hwid == null || body.hwid.isEmpty()) {
                ctx.json(new ErrorResponse("HWID обязателен"));
                return;
            }

            String hash = BCrypt.withDefaults().hashToString(12, body.password.toCharArray());

            boolean success = Database.registerUser(body.login, hash, body.hwid);
            if (!success) {
                ctx.json(new ErrorResponse("Пользователь уже существует"));
                return;
            }

            Database.User user = Database.loginUser(body.login, hash, body.hwid);
            if (user != null) {
                ctx.json(new AuthResponse(user.token, user.login, user.plan));
            } else {
                ctx.json(new ErrorResponse("Ошибка после регистрации"));
            }
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка сервера"));
        }
    }

    private static void handleLogin(Context ctx) {
        try {
            var body = ctx.bodyAsClass(LoginRequest.class);

            if (body.login == null || body.password == null || body.hwid == null) {
                ctx.json(new ErrorResponse("Все поля обязательны"));
                return;
            }

            String hash = BCrypt.withDefaults().hashToString(12, body.password.toCharArray());
            Database.User user = Database.loginUser(body.login, hash, body.hwid);

            if (user == null) {
                ctx.json(new ErrorResponse("Неверный логин или пароль"));
                return;
            }

            ctx.json(new AuthResponse(user.token, user.login, user.plan));
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка сервера"));
        }
    }

    private static void handleCheck(Context ctx) {
        try {
            String token = ctx.queryParam("token");
            String hwid = ctx.queryParam("hwid");

            if (token == null || hwid == null) {
                ctx.json(new ErrorResponse("token и hwid обязательны"));
                return;
            }

            Database.User user = Database.checkToken(token, hwid);
            if (user == null) {
                ctx.json(new ErrorResponse("Невалидный токен"));
                return;
            }

            ctx.json(new CheckResponse(true, user.login, user.plan, user.expires));
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка сервера"));
        }
    }

    private static void handleActivate(Context ctx) {
        try {
            var body = ctx.bodyAsClass(ActivateRequest.class);

            if (body.key == null || body.hwid == null) {
                ctx.json(new ErrorResponse("Ключ и HWID обязательны"));
                return;
            }

            Database.User user = Database.activateKey(body.key, body.hwid);
            if (user == null) {
                ctx.json(new ErrorResponse("Неверный или использованный ключ"));
                return;
            }

            ctx.json(new AuthResponse(user.token, user.login, user.plan));
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка сервера"));
        }
    }

    private static void handleDownload(Context ctx) {
        try {
            String filename = ctx.pathParam("filename");
            String safeName = filename.replaceAll("[^a-zA-Z0-9._\\-]", "");

            File file = new File("client-files/" + safeName);
            if (!file.exists()) {
                ctx.status(404).json(new ErrorResponse("Файл не найден"));
                return;
            }

            ctx.result(new java.io.FileInputStream(file));
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка скачивания"));
        }
    }

    private static void handleLatest(Context ctx) {
        ctx.json(new LatestResponse("1.0.0", "Minecraft 1.21.11 Fabric"));
    }

    private static void handleGenerateKeys(Context ctx) {
        try {
            var body = ctx.bodyAsClass(GenerateKeysRequest.class);
            if (body.plan == null || body.count <= 0) {
                ctx.json(new ErrorResponse("plan и count обязательны"));
                return;
            }

            boolean success = Database.generateKeys(body.plan, body.count);
            if (success) {
                ctx.json(new SuccessResponse("Сгенерировано " + body.count + " ключей для " + body.plan));
            } else {
                ctx.json(new ErrorResponse("Ошибка генерации ключей"));
            }
        } catch (Exception e) {
            ctx.status(500).json(new ErrorResponse("Ошибка сервера"));
        }
    }

    record RegisterRequest(String login, String password, String hwid) {}
    record LoginRequest(String login, String password, String hwid) {}
    record ActivateRequest(String key, String hwid) {}
    record GenerateKeysRequest(String plan, int count) {}
    record AuthResponse(String token, String login, String plan) {}
    record CheckResponse(boolean valid, String login, String plan, String expires) {}
    record LatestResponse(String version, String description) {}
    record ErrorResponse(String error) {}
    record SuccessResponse(String message) {}
}
