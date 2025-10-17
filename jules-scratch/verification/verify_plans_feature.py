from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Log in
    page.goto("http://localhost:3000/login")
    page.get_by_label("Email").fill("admin@example.com")
    page.get_by_label("Password").fill("password")
    page.get_by_role("button", name="Login").click()

    # Navigate to the admin plans page
    page.goto("http://localhost:3000/admin/plans")

    # Wait for the page to load and take a screenshot
    expect(page.get_by_role("heading", name="Subscription plans")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)