// Burger-Menü Toggle + automatisches Schließen bei Klick auf Link
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const menu = document.getElementById('menu');
    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        const links = menu.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function() {
                menu.classList.remove('show');
            });
        });

        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target) && !menuToggle.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
    }
});
