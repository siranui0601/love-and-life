const gameTap = document.querySelector("#gameTap");

if (gameTap) {
  gameTap.addEventListener("click", () => {
    const literaryClubUrl = new URL("/時々文芸部！/", window.location.origin);
    window.location.href = literaryClubUrl.toString();
  });
}
