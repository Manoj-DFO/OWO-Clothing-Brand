
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

// =====================================
// OWO - KARNATAKA LUXURY 3D MAP
// =====================================

const canvas = document.getElementById("owoHeroCanvas");
const stage = document.querySelector(".hero-3d-stage");

if (!canvas || !stage) {
    console.error("OWO: Canvas or 3D stage not found.");
} else {
    initOWOMap();
}

function initOWOMap() {

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // =====================================
    // PREMIUM LIGHTING
    // =====================================

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));

    const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,
        0x202a35,
        1.5
    );
    scene.add(hemisphereLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(3, 5, 8);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x829bb5, 2.2, 14);
    rimLight.position.set(-3, 1, 4);
    scene.add(rimLight);

    const softLight = new THREE.PointLight(0xb69a76, 0.8, 12);
    softLight.position.set(3, -3, 3);
    scene.add(softLight);

    // =====================================
    // MAP GROUPS
    // =====================================

    const display = new THREE.Group();
    scene.add(display);

    const mapGroup = new THREE.Group();
    display.add(mapGroup);

    const NORTH_YELLOW = new THREE.Color("#ffd500");
    const SOUTH_RED = new THREE.Color("#ff2525");

    const NORTH_SPLIT = 0.44;

    // =====================================
    // LOAD KARNATAKA SVG
    // =====================================

    const loader = new SVGLoader();

    loader.load(
        "./karnataka.svg",

        (data) => {

            console.log("OWO: Karnataka SVG loaded.");

            let bestOutline = null;
            let bestPointCount = 0;

            for (const path of data.paths) {

                for (const subPath of path.subPaths) {

                    const outlinePoints = subPath.getPoints(4);

                    if (outlinePoints.length < 10) continue;

                    const bounds = new THREE.Box2().setFromPoints(outlinePoints);

                    const width = bounds.max.x - bounds.min.x;
                    const height = bounds.max.y - bounds.min.y;

                    if (width <= 0 || height <= 0) continue;
                    if (width > 850 && height > 850) continue;

                    if (outlinePoints.length > bestPointCount) {
                        bestPointCount = outlinePoints.length;
                        bestOutline = outlinePoints;
                    }
                }
            }

            if (!bestOutline) {
                console.error("OWO: Karnataka outline not found.");
                return;
            }

            // =====================================
            // CREATE STATE SHAPE
            // =====================================

            const outline = [...bestOutline];

            if (
                outline[0].distanceTo(
                    outline[outline.length - 1]
                ) < 0.001
            ) {
                outline.pop();
            }

            const mainShape = new THREE.Shape();

            mainShape.moveTo(outline[0].x, outline[0].y);

            for (let i = 1; i < outline.length; i++) {
                mainShape.lineTo(outline[i].x, outline[i].y);
            }

            mainShape.closePath();

            const points = mainShape.getPoints(600);

            const bounds = new THREE.Box2().setFromPoints(points);

            const minX = bounds.min.x;
            const minY = bounds.min.y;
            const maxX = bounds.max.x;
            const maxY = bounds.max.y;

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const mapWidth = maxX - minX;
            const mapHeight = maxY - minY;

            if (mapWidth <= 0 || mapHeight <= 0) {
                console.error("OWO: Invalid map dimensions.");
                return;
            }

            const splitY = minY + mapHeight * NORTH_SPLIT;

            const thickness = mapWidth * 0.035;
            const borderZ = thickness + mapWidth * 0.006;

            // =====================================
            // DARK METALLIC BODY
            // =====================================

            const mapGeometry = new THREE.ExtrudeGeometry(mainShape, {
                depth: thickness,
                bevelEnabled: true,
                bevelThickness: mapWidth * 0.003,
                bevelSize: mapWidth * 0.0025,
                bevelSegments: 5,
                curveSegments: 24
            });

            mapGeometry.translate(-centerX, -centerY, 0);

            const mapMaterial = new THREE.MeshPhysicalMaterial({
                color: "#12171d",
                metalness: 0.78,
                roughness: 0.29,
                clearcoat: 0.7,
                clearcoatRoughness: 0.22,
                side: THREE.DoubleSide
            });

            const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
            mapGroup.add(mapMesh);

            // =====================================
            // SMOOTH BORDER PATH
            // =====================================

            const routePoints = points.map(point =>
                new THREE.Vector3(
                    point.x - centerX,
                    point.y - centerY,
                    borderZ
                )
            );

            // Remove duplicate closing point.
            if (
                routePoints[0].distanceTo(
                    routePoints[routePoints.length - 1]
                ) < 0.001
            ) {
                routePoints.pop();
            }

            const borderCurve = new THREE.CatmullRomCurve3(
                routePoints,
                true,
                "centripetal"
            );

            // =====================================
            // YELLOW NORTH / RED SOUTH BORDER
            // =====================================

            function createColouredBorder(radius, opacity, glow = false) {

                const geometry = new THREE.TubeGeometry(
                    borderCurve,
                    700,
                    radius,
                    10,
                    true
                );

                const positions = geometry.attributes.position;
                const colours = [];

                for (let i = 0; i < positions.count; i++) {

                    const originalY = positions.getY(i) + centerY;

                    const colour = originalY < splitY
                        ? NORTH_YELLOW
                        : SOUTH_RED;

                    colours.push(
                        colour.r,
                        colour.g,
                        colour.b
                    );
                }

                geometry.setAttribute(
                    "color",
                    new THREE.Float32BufferAttribute(colours, 3)
                );

                const material = new THREE.MeshBasicMaterial({
                    vertexColors: true,
                    transparent: glow,
                    opacity,
                    blending: glow
                        ? THREE.AdditiveBlending
                        : THREE.NormalBlending,
                    depthWrite: !glow,
                    toneMapped: false
                });

                const mesh = new THREE.Mesh(geometry, material);

                mesh.renderOrder = glow ? 2 : 3;
                mapGroup.add(mesh);

                return mesh;
            }

            // Existing layered glow preserved.
            const outerGlow = createColouredBorder(
                mapWidth * 0.009,
                0.16,
                true
            );

            const middleGlow = createColouredBorder(
                mapWidth * 0.005,
                0.30,
                true
            );

            const mainBorder = createColouredBorder(
                mapWidth * 0.0018,
                1,
                false
            );

            // =====================================
            // MOVING WHITE LIGHT
            // =====================================

            const runner = new THREE.Mesh(
                new THREE.SphereGeometry(
                    mapWidth * 0.009,
                    24,
                    24
                ),
                new THREE.MeshBasicMaterial({
                    color: "#ffffff",
                    toneMapped: false
                })
            );

            const runnerGlow = new THREE.Mesh(
                new THREE.SphereGeometry(
                    mapWidth * 0.035,
                    24,
                    24
                ),
                new THREE.MeshBasicMaterial({
                    color: "#ffffff",
                    transparent: true,
                    opacity: 0.35,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                })
            );

            const runnerHalo = new THREE.Mesh(
                new THREE.SphereGeometry(
                    mapWidth * 0.065,
                    24,
                    24
                ),
                new THREE.MeshBasicMaterial({
                    color: "#ffffff",
                    transparent: true,
                    opacity: 0.10,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                })
            );

            mapGroup.add(runner, runnerGlow, runnerHalo);

            // =====================================
            // RESPONSIVE MAP SIZE AND POSITION
            // =====================================

            function updateMapScale() {

                const aspect = stage.clientWidth / stage.clientHeight;

                const viewHeight =
                    2 * camera.position.z *
                    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

                const viewWidth = viewHeight * aspect;

                // Keep the complete outline visible with breathing room.
                const scale = Math.min(
                    viewWidth * 0.84 / mapWidth,
                    viewHeight * 0.84 / mapHeight
                );

                mapGroup.scale.set(scale, -scale, scale);
            }

            // =====================================
            // MOUSE MOVEMENT
            // =====================================

            let mouseX = 0;
            let mouseY = 0;

            stage.addEventListener("pointermove", event => {

                const rect = stage.getBoundingClientRect();

                mouseX =
                    ((event.clientX - rect.left) / rect.width - 0.5) * 0.28;

                mouseY =
                    ((event.clientY - rect.top) / rect.height - 0.5) * 0.18;
            });

            stage.addEventListener("pointerleave", () => {
                mouseX = 0;
                mouseY = 0;
            });

            // =====================================
            // RESPONSIVE CANVAS
            // =====================================

            function resize() {

                const width = stage.clientWidth;
                const height = stage.clientHeight;

                if (!width || !height) return;

                renderer.setSize(width, height, false);

                camera.aspect = width / height;
                camera.updateProjectionMatrix();

                updateMapScale();
            }

            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(stage);

            resize();

            // =====================================
            // ANIMATION
            // =====================================

            const clock = new THREE.Clock();

            function animate() {

                requestAnimationFrame(animate);

                const elapsed = clock.getElapsedTime();

                display.rotation.y +=
                    (mouseX - display.rotation.y) * 0.025;

                display.rotation.x +=
                    (-mouseY - display.rotation.x) * 0.025;

                display.position.y =
                    Math.sin(elapsed * 0.8) * 0.025;

                // Border glow animation
                outerGlow.material.opacity =
                    0.12 + (Math.sin(elapsed * 2) + 1) * 0.055;

                middleGlow.material.opacity =
                    0.22 + (Math.sin(elapsed * 2.5) + 1) * 0.10;

                // Moving light
                const progress = (elapsed * 0.075) % 1;

                const movingPosition =
                    borderCurve.getPointAt(progress);

                runner.position.copy(movingPosition);
                runnerGlow.position.copy(movingPosition);
                runnerHalo.position.copy(movingPosition);

                runnerGlow.material.opacity =
                    0.22 + (Math.sin(elapsed * 5) + 1) * 0.12;

                runnerHalo.material.opacity =
                    0.07 + (Math.sin(elapsed * 4) + 1) * 0.045;

                renderer.render(scene, camera);
            }

            animate();

            console.log("OWO: Luxury Karnataka 3D map running.");
        },

        undefined,

        error => {
            console.error("OWO: Could not load karnataka.svg.", error);
        }
    );
}
