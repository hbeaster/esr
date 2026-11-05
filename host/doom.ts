/** Demo-only page that runs the self-hosted DOOM shareware bundle in js-dos. */
const JS_DOS = "https://cdn.jsdelivr.net/npm/js-dos@8.5.3/dist/";

type DosFn = (
  element: HTMLElement,
  options: {
    url: string;
    pathPrefix: string;
    autoStart: boolean;
    noCloud: boolean;
    kiosk: boolean;
  },
) => unknown;

const Dos = (window as unknown as { Dos?: DosFn }).Dos;
const element = document.getElementById("dos");
if (!element) throw new Error("The DOOM page markup is missing.");
if (!Dos) {
  element.textContent = "The js-dos player could not be loaded.";
} else {
  Dos(element, {
    url: `${import.meta.env.BASE_URL}doom/doom-shareware.zip`,
    pathPrefix: `${JS_DOS}emulators/`,
    autoStart: true,
    noCloud: true,
    kiosk: true,
  });
}
