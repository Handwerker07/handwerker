document.addEventListener("DOMContentLoaded", () => {
  const categoryTabs = document.querySelectorAll(".category-tabs .tab");
  const categoryGrid = document.querySelector(".category-grid");

  // Function to update the grid with items of the selected category
  const updateGrid = async (category) => {
    const scrollPosition = window.scrollY; // Store the current scroll position

    categoryGrid.innerHTML = "<p class='loading-text'>Loading...</p>"; // Show loading text

    // Simulate AJAX delay (remove in actual implementation)
    await new Promise((resolve) => setTimeout(resolve, 500)); 

    const items = allItems[category]?.slice(0, 20) || []; // Limit to 20 items
    categoryGrid.innerHTML = ""; // Clear loading message

    if (items.length === 0) {
      categoryGrid.innerHTML = "<p>No items available in this category.</p>"; // Fallback message
    }

    items.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.classList.add("top-selling-card");

      // Dynamically create the HTML for the image container
      const imageContainerHTML = `
        <div class="image-container" style="position: relative;">
          <img src="/images/items/${item.photos[0]._id}.webp" alt="${item.name}" class="top-selling-image primary">
          ${item.photos.length > 1
          ? `<img src="/images/items/${item.photos[1]._id}.webp" alt="${item.name}" class="top-selling-image secondary">`
          : ""}
        </div>
      `;

      // Add the offer badge if the item has an offer
      const offerBadgeHTML = item.offer > 0 
        ? `<div class="offer-badge">${item.offer}% OFF</div>`
        : "";

      // Set the content of the item element
      itemElement.innerHTML = `
        ${imageContainerHTML}
        ${offerBadgeHTML} <!-- Insert the offer badge here -->
        <div class="top-selling-info">
          <h4>${item.name}</h4>
          <p>₨${item.price.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}</p>
          ${item.offer > 0
          ? `<p class="offer-price">Offer: ₨${(
            item.price - (item.price * item.offer) / 100
          ).toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}</p>`
          : ""}
          <a href="/product/${item._id}" class="view-details-button">Product Details</a>
        </div>
      `;

      // Append the item to the grid
      categoryGrid.appendChild(itemElement);
    });

    // Restore the scroll position after update
    window.scrollTo(0, scrollPosition);
  };

  // Add click event listeners to all category tabs
  categoryTabs.forEach((tab) => {
    tab.addEventListener("click", async (event) => {
      event.preventDefault();

      // Remove active class from all tabs and add to the clicked one
      categoryTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Update the grid for the clicked category
      const selectedCategory = tab.getAttribute("data-category");
      await updateGrid(selectedCategory);
    });
  });

  // Initialize the grid with the default category (All tab) while keeping the scroll position
  updateGrid("all");
});
