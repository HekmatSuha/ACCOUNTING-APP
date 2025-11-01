from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate to the login page
        page.goto("file:///app/frontend/build/index.html")

        # Wait for the login form to be visible
        expect(page.get_by_label("Username")).to_be_visible()
        expect(page.get_by_label("Password")).to_be_visible()

        # Log in
        page.get_by_label("Username").fill("testuser")
        page.get_by_label("Password").fill("testpassword")
        page.get_by_role("button", name="Login").click()

        # Wait for navigation to the dashboard
        expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()

        # Navigate to the suppliers page
        page.get_by_role("link", name="Suppliers").click()
        expect(page.get_by_role("heading", name="Suppliers")).to_be_visible()

        # Click the "Add New Supplier" button
        page.get_by_role("button", name="Add New Supplier").click()
        expect(page.get_by_role("heading", name="New Supplier")).to_be_visible()

        # Verify that the image upload input is visible
        image_upload_input = page.get_by_label("Supplier Image")
        expect(image_upload_input).to_be_visible()

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
