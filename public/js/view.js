document.addEventListener('DOMContentLoaded', () => {
  const mainImage = document.getElementById('mainImage');
  const zoomBox = document.getElementById('zoomBox');

  const incrementBtn = document.querySelector('.increment-btn');
  const decrementBtn = document.querySelector('.decrement-btn');
  const quantityInput = document.querySelector('.quantity-input');

  const toggleButtons = document.querySelectorAll('.toggle-btn');

  const favoriteBtn = document.getElementById("favoriteBtn");
  const itemId = favoriteBtn?.getAttribute("data-item-id");

  // Automatically expand the first tab on page load
  const firstToggleButton = toggleButtons[0];
  const firstTabContent = document.getElementById(firstToggleButton.getAttribute('data-target'));
  firstTabContent.style.maxHeight = firstTabContent.scrollHeight + 'px'; // Set height dynamically
  firstTabContent.style.padding = '15px'; // Add padding
  firstToggleButton.setAttribute('aria-expanded', 'true');
  firstToggleButton.textContent = '-';

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const targetContent = document.getElementById(targetId);
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      // Close all other tabs
      toggleButtons.forEach((otherButton) => {
        const otherTargetId = otherButton.getAttribute('data-target');
        const otherTargetContent = document.getElementById(otherTargetId);

        if (otherButton !== button) {
          otherButton.setAttribute('aria-expanded', 'false');
          otherButton.textContent = '+';
          otherTargetContent.style.maxHeight = '0';
          otherTargetContent.style.padding = '0 15px 0';
        }
      });

      if (isExpanded) {
        // Close current tab
        targetContent.style.maxHeight = '0'; // Collapse the tab
        targetContent.style.padding = '0 15px 0'; // Remove padding
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '+';
      } else {
        // Open current tab
        targetContent.style.maxHeight = targetContent.scrollHeight + 'px'; // Set height dynamically
        targetContent.style.padding = '15px'; // Add padding
        button.setAttribute('aria-expanded', 'true');
        button.textContent = '-';
      }
    });
  });

  // Add other existing functionality...

  const thumbnails = document.querySelectorAll('.thumbnail');
  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener('click', () => {
      const photoId = thumbnail.getAttribute('data-photo-id');

      // Update main image
      mainImage.style.backgroundImage = `url('/api/getImage/${photoId}')`;

      // Remove 'active' class from all thumbnails and add to the clicked one
      thumbnails.forEach((thumb) => thumb.classList.remove('active'));
      thumbnail.classList.add('active');
    });
  });

  const maxQuantity = parseInt(quantityInput.getAttribute('max'), 10);

  incrementBtn.addEventListener('click', () => {
    let currentValue = parseInt(quantityInput.value, 10);
    if (currentValue < maxQuantity) {
      quantityInput.value = currentValue + 1;
    }
  });

  decrementBtn.addEventListener('click', () => {
    let currentValue = parseInt(quantityInput.value, 10);
    if (currentValue > 1) {
      quantityInput.value = currentValue - 1;
    }
  });

  mainImage.addEventListener('mouseenter', () => {
    zoomBox.style.display = 'block';
    zoomBox.style.backgroundImage = mainImage.style.backgroundImage;
  });

  mainImage.addEventListener('mouseleave', () => {
    zoomBox.style.display = 'none';
  });

  mainImage.addEventListener('mousemove', (e) => {
    const rect = mainImage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    zoomBox.style.backgroundPosition = `${x}% ${y}%`;
  });

  if (!favoriteBtn || !itemId) return; // Stop if no button exists

  // Function to check if the item is already in favorites
  fetch(`/favourites/check/${itemId}`)
    .then(response => {
      if (!response.ok) throw new Error("Network response was not OK");
      return response.json();
    })
    .then(data => {
      if (data.isFavorite) {
        favoriteBtn.classList.add("active");
      }
    })
    .catch(error => console.error("Error fetching favorite status:", error));

  // Toggle favorite when clicking the button
  favoriteBtn.addEventListener("click", function () {
    // Check if the user is authenticated
    fetch('/auth/check-auth') // Endpoint to check user authentication status
      .then(response => {
        if (!response.ok) throw new Error("Network response was not OK");
        return response.json();
      })
      .then(data => {
        if (!data.isAuthenticated) {
          // Redirect to sign-in page if not authenticated
          window.location.href = '/auth/login';
          return;
        }

        // If authenticated, toggle the favorite
        fetch(`/favourites/toggle/${itemId}`, { method: "POST" })
          .then(response => {
            if (!response.ok) throw new Error("Network response was not OK");
            return response.json();
          })
          .then(data => {
            if (data.success) {
              favoriteBtn.classList.toggle("active");
            }
          })
          .catch(error => console.error("Error toggling favorite:", error));
      })
      .catch(error => console.error("Error checking authentication:", error));
  });
});
