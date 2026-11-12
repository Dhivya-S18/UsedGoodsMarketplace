// sell.js

document.addEventListener("DOMContentLoaded", () => {
    initializeSellPage();
});

function initializeSellPage() {
    const form = document.getElementById("sell-form");

    if (!form) return;

    initializeImagePreview();

    // Product submission
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        await createProduct();
    });

    // Gemini description generation
    const generateButton =
        document.getElementById("generate-description-btn");

    if (generateButton) {
        generateButton.addEventListener("click", generateDescription);
    }
}

// ---------------- CREATE PRODUCT ----------------

async function createProduct() {
    const message = document.getElementById("sell-message");

    if (!AuthStorage.isLoggedIn()) {
        showMessage(
            message,
            "Please log in before posting a product.",
            "error"
        );

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);

        return;
    }

    const title =
        document.getElementById("product-title")?.value.trim();

    const category =
        document.getElementById("category")?.value;

    const productType =
        document.getElementById("product-type")?.value.trim();

    const price =
        Number(document.getElementById("price")?.value);

    const condition =
        document.getElementById("condition")?.value;

    const description =
        document.getElementById("description")?.value.trim();
    const image =
        document.getElementById("product-image")?.files[0];

    if (
        !title ||
        !category ||
        !productType ||
        !condition ||
        !description ||
        price <= 0
    ) {
        showMessage(
            message,
            "Please complete all required product details.",
            "error"
        );
        return;
    }

    if (image && image.size > 5 * 1024 * 1024) {
        showMessage(message, "Image must be 5 MB or smaller.", "error");
        return;
    }

    if (image && !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        showMessage(message, "Choose a JPG, PNG, or WebP image.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("product_type", productType);
    formData.append("price", String(price));
    formData.append("description", description);
    formData.append("condition", condition);
    if (image) {
        formData.append("image", image);
    }

    try {
        const result = await apiRequest(API.PRODUCTS, {
            method: "POST",
            body: formData
        });

        showMessage(
            message,
            result.message || "Product posted successfully!",
            "success"
        );

        document.getElementById("sell-form").reset();
        clearImagePreview();

    } catch (error) {
        showMessage(message, error.message, "error");
    }
}

function initializeImagePreview() {
    const imageInput = document.getElementById("product-image");
    const previewBox = document.getElementById("image-preview-box");
    const previewImage = document.getElementById("image-preview");
    const filename = document.getElementById("image-filename");
    const uploadField = document.getElementById("upload-field");
    const removeButton = document.getElementById("remove-image-btn");

    if (!imageInput || !previewBox || !previewImage || !filename || !uploadField) {
        return;
    }

    imageInput.addEventListener("change", () => {
        const image = imageInput.files[0];
        if (!image) {
            clearImagePreview();
            return;
        }

        if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
            imageInput.value = "";
            clearImagePreview();
            showMessage(
                document.getElementById("sell-message"),
                "Choose a JPG, PNG, or WebP image.",
                "error"
            );
            return;
        }

        if (image.size > 5 * 1024 * 1024) {
            imageInput.value = "";
            clearImagePreview();
            showMessage(
                document.getElementById("sell-message"),
                "Image must be 5 MB or smaller.",
                "error"
            );
            return;
        }

        clearImagePreview();
        previewImage.src = URL.createObjectURL(image);
        filename.textContent = image.name;
        previewBox.hidden = false;
        uploadField.hidden = true;
    });

    removeButton?.addEventListener("click", () => {
        imageInput.value = "";
        clearImagePreview();
    });
}

function clearImagePreview() {
    const previewImage = document.getElementById("image-preview");
    const previewBox = document.getElementById("image-preview-box");
    const filename = document.getElementById("image-filename");
    const uploadField = document.getElementById("upload-field");

    if (previewImage?.src.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage.src);
    }
    if (previewImage) previewImage.removeAttribute("src");
    if (filename) filename.textContent = "";
    if (previewBox) previewBox.hidden = true;
    if (uploadField) uploadField.hidden = false;
}

// ---------------- GEMINI DESCRIPTION ----------------

async function generateDescription() {
    const button =
        document.getElementById("generate-description-btn");

    const message = document.getElementById("ai-message");

    const title =
        document.getElementById("product-title")?.value.trim();

    const category =
        document.getElementById("category")?.value;

    const productType =
        document.getElementById("product-type")?.value.trim();

    const price =
        Number(document.getElementById("price")?.value);

    const condition =
        document.getElementById("condition")?.value;

    if (!title || !category || !productType || price <= 0 || !condition) {
        showMessage(
            message,
            "Enter the product name, category, type, price, and condition first.",
            "error"
        );
        return;
    }

    try {
        button.disabled = true;
        button.textContent = "Generating...";

        showMessage(
            message,
            "Gemini is generating your product description...",
            "info"
        );

        const result = await apiRequest(API.GENERATE_DESCRIPTION, {
            method: "POST",
            body: JSON.stringify({
                title,
                category,
                product_type: productType,
                price,
                condition
            })
        });

        const descriptionField =
            document.getElementById("description");

        if (descriptionField) {
            descriptionField.value = result.description;
        }

        showMessage(
            message,
            "AI description generated successfully!",
            "success"
        );

    } catch (error) {
        const messageText =
            error.message ===
                "The AI description service is temporarily busy. Please try again shortly."
                ? error.message
                : "The AI description could not be generated right now. Please try again shortly.";

        showMessage(
            message,
            messageText,
            "error"
        );

    } finally {
        button.disabled = false;
        button.textContent = "Generate Description with AI";
    }
}