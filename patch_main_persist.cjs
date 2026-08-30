const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf8');

// Find the toggle event listener
code = code.replace(
    "toggleChartImage.addEventListener('change', (e) => {",
    "toggleChartImage.addEventListener('change', (e) => {\n            localStorage.setItem('tja_tools_show_image', e.target.checked);"
);

// Initialization: check local storage at load
code = code.replace(
    "const toggleChartImage = document.getElementById('toggle-chart-image');",
    `const toggleChartImage = document.getElementById('toggle-chart-image');
    if (toggleChartImage) {
        const savedToggle = localStorage.getItem('tja_tools_show_image');
        if (savedToggle !== null) {
            toggleChartImage.checked = (savedToggle === 'true');
            const container = document.getElementById('chart-canvas-container');
            if (container) {
                if (toggleChartImage.checked) container.classList.remove('is-hidden');
                else container.classList.add('is-hidden');
            }
        }
    }`
);

fs.writeFileSync('src/main.js', code);
