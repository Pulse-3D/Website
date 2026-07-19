const year = document.querySelector("#year");
const contactButton = document.querySelector("#contact-button");
const copyStatus = document.querySelector("#copy-status");

year.textContent = new Date().getFullYear();

contactButton.addEventListener("click", async () => {
  const email = "kumaraarush022@gmail.com";

  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = `Copied ${email}`;
  } catch {
    copyStatus.textContent = email;
  }
});
