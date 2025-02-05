let currentSlide = 0;

// Function to move to the left slide
function moveLeft() {
    const slides = document.querySelector('.carousel-slide');
    const totalSlides = slides.children.length;

    currentSlide = (currentSlide === 0) ? totalSlides - 1 : currentSlide - 1;
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
}

// Function to move to the right slide
function moveRight() {
    const slides = document.querySelector('.carousel-slide');
    const totalSlides = slides.children.length;

    currentSlide = (currentSlide === totalSlides - 1) ? 0 : currentSlide + 1;
    slides.style.transform = `translateX(-${currentSlide * 100}%)`;
}

// Function to automatically slide banners every 10 seconds
function autoSlide() {
    setInterval(() => {
        moveRight();
    }, 10000); // 10 seconds interval
}

// Initialize the carousel auto-slide
document.addEventListener('DOMContentLoaded', () => {
    autoSlide();
});
