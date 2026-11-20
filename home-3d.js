
/* =========================================
   OWO ENDLESS 3D IMAGE CORRIDOR
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const world = document.getElementById("owoEndlessWorld");

    if (!world || typeof gsap === "undefined") {
        console.error("OWO 3D hero: GSAP or hero element missing.");
        return;
    }

    const IMAGE_URLS = [
        "https://cdn.21st.dev/assets/mirror/49/496b84975083e207d6b9adf6898f417d9e66250a5fa0b324db7d69c24081e665.webp",
        "https://cdn.21st.dev/assets/mirror/56/565902d9502c3c50a98cd8dc1447754d865c370597acbf789e44e061abc98e02.webp",
        "https://cdn.21st.dev/assets/mirror/37/37149990d5ddbf0ad349dcffff6917efb95d450ff176bc7b911420a8bbce968d.webp",
        "https://cdn.21st.dev/assets/mirror/4f/4f0af24dd1f4e5f89e5b5ae1f10b711e837c279ebf1daea092a3376a4bfb4400.webp",
        "https://cdn.21st.dev/assets/mirror/95/9579da7038028c3ef96b8cca6a887ddb406851f37caa13a85627ce72975f16f0.webp",
        "https://cdn.21st.dev/assets/mirror/4b/4bd8b7ff2db5fb0d805712b372dcf2820752b709b377db8ac073f65abf7591f8.webp",
        "https://cdn.21st.dev/assets/mirror/d0/d0c716fa9bb2a2cbf7dda8f41ffdcda0aa12a5c1db1951ed093935e51377bdb0.webp",
        "https://cdn.21st.dev/assets/mirror/d1/d1c14c08413e7d35bc090bfe4ea560c88314c9899a10fb4a1791ce3a76d6a71e.webp",
        "https://cdn.21st.dev/assets/mirror/94/9409bb00df0c1bbb30e4e782f33b06232f39f39c9a5c4cf3e830853316be6e77.webp",
        "https://cdn.21st.dev/assets/mirror/bf/bf54bb945a1a7d3c154146a499bbb895b0c59d48e913c2377e380aa11ee5a5c2.webp",
        "https://cdn.21st.dev/assets/mirror/1f/1f2db3e1105e8a09b30a319647a614bfc0a6858e56a54e6a156ff0eeeb0984a7.webp",
        "https://cdn.21st.dev/assets/mirror/74/74388f29a6841a42a35929cea6e1acff8a748a69294ea03dfe78b61e74e2fa4c.webp"
    ];

    const TOTAL = IMAGE_URLS.length;

    const Z_FAR = -2400;
    const Z_NEAR = 780;
    const RANGE = Z_NEAR - Z_FAR;

    const DURATION = 16;
    const FADE_IN = 0.06;
    const FADE_OUT = 0.04;

    const planes = [];

    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    function opacityForProgress(progress) {

        if (progress < FADE_IN) {
            return Math.max(0, progress / FADE_IN);
        }

        if (progress > 1 - FADE_OUT) {
            return Math.max(
                0,
                (1 - progress) / FADE_OUT
            );
        }

        return 1;
    }

    // CREATE IMAGE PLANES

    IMAGE_URLS.forEach((url, index) => {

        const plane = document.createElement("div");
        plane.className = "owo-endless-plane";

        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.loading = "eager";
        img.decoding = "async";

        plane.appendChild(img);
        world.appendChild(plane);

        planes.push({
            element: plane,
            image: img,
            index: index
        });

    });

    // RESPONSIVE LAYOUT

    function applyLayout() {

        const width = window.innerWidth;

        const planeW = width < 768
            ? Math.min(width * 0.26, 200)
            : Math.min(width * 0.26, 440);

        const planeH = planeW * (4 / 3);

        const offsetX = width * 0.33;
        const angle = 24;

        planes.forEach(({ element, index }) => {

            const isLeft = index % 2 === 0;

            element.style.width = `${planeW}px`;
            element.style.height = `${planeH}px`;

            gsap.set(element, {

                xPercent: -50,
                yPercent: -50,

                x: isLeft
                    ? -offsetX
                    : offsetX,

                y: 0,

                rotationY: isLeft
                    ? angle
                    : -angle,

                force3D: true

            });

        });

    }

    applyLayout();

    gsap.set(world, { force3D: true });

    // ANIMATE PLANES

    planes.forEach(({ element, image, index }) => {

        const startProgress = index / TOTAL;

        gsap.set(element, {
            z: Z_FAR + startProgress * RANGE
        });

        image.style.opacity = String(
            opacityForProgress(startProgress)
        );

        element.style.zIndex = String(
            Math.round(startProgress * 1000)
        );

        if (reduceMotion) return;

        const tween = gsap.fromTo(

            element,

            {
                z: Z_FAR
            },

            {

                z: Z_NEAR,

                duration: DURATION,

                ease: "none",

                repeat: -1,

                immediateRender: false,

                onUpdate() {

                    const progress = this.progress();

                    image.style.opacity = String(
                        opacityForProgress(progress)
                    );

                    element.style.zIndex = String(
                        Math.round(progress * 1000)
                    );

                }

            }

        );

        tween.progress(startProgress);

    });

    // RESIZE HANDLING

    let resizeFrame;

    window.addEventListener("resize", () => {

        cancelAnimationFrame(resizeFrame);

        resizeFrame = requestAnimationFrame(() => {
            applyLayout();
        });

    });

});
