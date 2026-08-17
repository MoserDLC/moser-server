document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        var target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// Navbar
window.addEventListener('scroll', function() {
    var navbar = document.querySelector('.navbar');
    navbar.style.background = window.scrollY > 50
        ? 'rgba(12, 12, 20, 0.96)'
        : 'rgba(12, 12, 20, 0.9)';
});

// Scroll reveal + stats counter
document.addEventListener('DOMContentLoaded', function() {
    var els = document.querySelectorAll('.bento-card, .review-card, .screenshot-card, .buy-card, .stat-card, .faq-item, .section-title, .section-subtitle');
    els.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';

                // Trigger stats counter for stat-cards
                if (entry.target.classList.contains('stat-card')) {
                    var num = entry.target.querySelector('.stat-card-number');
                    var fill = entry.target.querySelector('.stat-card-fill');
                    if (num) {
                        var target = parseInt(num.getAttribute('data-target'));
                        var cur = 0;
                        var inc = target / 50;
                        var timer = setInterval(function() {
                            cur += inc;
                            if (cur >= target) { cur = target; clearInterval(timer); }
                            num.textContent = Math.floor(cur);
                        }, 20);
                    }
                    if (fill) {
                        var w = fill.style.width;
                        fill.style.width = '0';
                        setTimeout(function() { fill.style.width = w; }, 100);
                    }
                }

                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    els.forEach(function(el) { obs.observe(el); });
});

// FAQ
document.querySelectorAll('.faq-question').forEach(function(q) {
    q.addEventListener('click', function() {
        var item = this.parentElement;
        var open = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(function(i) { i.classList.remove('active'); });
        if (!open) item.classList.add('active');
    });
});
