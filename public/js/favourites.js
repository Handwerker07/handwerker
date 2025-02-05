document.addEventListener("DOMContentLoaded", () => {
    const removeLinks = document.querySelectorAll(".remove-link");

    removeLinks.forEach((link) => {
        link.addEventListener("click", async (event) => {
            event.preventDefault(); // Prevent default link behavior

            const productId = event.target.getAttribute("data-id");

            try {
                const response = await fetch(`/favourites/toggle/${productId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error("Network response was not OK");
                }

                const data = await response.json();

                // Since the product is already a favourite, toggling will remove it.
                if (data.success) {
                    // Remove the product card from the DOM
                    event.target.closest(".top-selling-card").remove();
                }
            } catch (error) {
                console.error("Error removing favourite:", error);
            }
        });
    });
});
