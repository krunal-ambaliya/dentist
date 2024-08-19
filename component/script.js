// loadNavbar.js

document.addEventListener("DOMContentLoaded", function() {
    // URL of the HTML snippet
    const navbarUrl = 'header.html';
    
    // Function to load the HTML snippet
    function loadNavbar() {
        fetch(navbarUrl)
            .then(response => response.text())
            .then(data => {
                // Create a container for the navbar
                const navbarContainer = document.createElement('div');
                navbarContainer.innerHTML = data;
                
                // Find the target location to insert the navbar
                const targetElement = document.querySelector('#navbar-container');
                
                if (targetElement) {
                    targetElement.innerHTML = navbarContainer.innerHTML;
                } else {
                    console.warn('Target element #navbar-container not found.');
                }
            })
            .catch(error => console.error('Error loading the navbar:', error));
    }

    // Load the navbar
    loadNavbar();
});
