//hand tracking
let video;
let handPose;
let hands = [];

//letter settings
let letter = "E";
let fontSize = 300;
let font;
let font2;
let font3;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;

//ripple movement parameters
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//noise settings
let zoff = 0;
let noiseInc = 0.01;
let minSize = 2;
let maxSize = 20;

//flick detection
let prevFingertipX = null; // Tracks combined average fingertip X
let prevFingertipY = null; // Tracks combined average fingertip Y
let flickSpeedThreshold = 25; // Adjusted threshold for omni-directional detection
let flickActive = false;

//shake decay parameters
let shakeDuration = 10; // frames of reverberation

// screenshot
let frozenImage = null;

// Keypoint indices for the tips of the fingers: 4, 8, 12, 16, 20
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

function preload() {
    font = loadFont("Movement-DirectThin.otf");
    handPose = ml5.handPose({ flipped: true });
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    angleMode(DEGREES);
    noFill();

    video = createCapture(VIDEO, { flipped: true });
    video.hide();

    // Start detection
    handPose.detectStart(video, gotHands);

    generatePoints();

    // capture screenshot after 1 minute
    setTimeout(captureLetter, 60000);
}

function gotHands(results) {
    hands = results;
}

function draw() {
    background(0);

    // show frozen image if captured
    if (frozenImage) {
        image(
            frozenImage,
            width / 2 - frozenImage.width / 2,
            height / 2 - frozenImage.height / 2
        );
        return;
    }

    detectHandFlick();
    //letter details
    textFont(font);
    strokeWeight(1);
    noFill();
    stroke(255);

    beginShape();
    for (let i = 0; i < points.length; i++) {
        let p = points[i];

        let phaseOffset = i * waveDelay;

        //ripples
        let localAmp = baseAmp + waveStrength * 0.1;
        let oscX = p.ox + localAmp * sin(angle + phaseOffset);
        let oscY = p.oy + localAmp * cos(angle + phaseOffset);

        p.x = lerp(p.x, oscX, 0.1);
        p.y = lerp(p.y, oscY, 0.1);

        // check for hand interaction
        if (flickActive && handOverPoint(p)) {
            // apply shake
            let shakeAmount = 20;
            p.x += random(-shakeAmount, shakeAmount);
            p.y += random(-shakeAmount, shakeAmount);

            // start shake timer for reverberation
            p.shakeTimer = shakeDuration;

            // colorize once
            if (!p.hovered) {
                p.r = random(255);
                p.g = random(255);
                p.b = random(255);
                p.hovered = true;
            }
        }

        // reverberation effect
        if (p.shakeTimer > 0) {
            let shakeDecay = p.shakeTimer / shakeDuration;
            let decayAmount = 15 * shakeDecay;
            p.x += random(-decayAmount, decayAmount);
            p.y += random(-decayAmount, decayAmount);
            p.shakeTimer--;
        }

        // fade color back to white when not shaken
        // The condition for fading back is: NOT flicking OR NOT hovering over a point
        if (!flickActive || !handOverPoint(p)) { 
            p.r = lerp(p.r, 255, 0.05);
            p.g = lerp(p.g, 255, 0.05);
            p.b = lerp(p.b, 255, 0.05);

            if (abs(p.r - 255) < 1 && abs(p.g - 255) < 1 && abs(p.b - 255) < 1) {
                p.hovered = false;
            }
        }

        // point size with perlin noise
        let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
        let ps = map(n, 0, 1, minSize, maxSize);

        // shrink points if shaking or reverberating
        if (p.shakeTimer > 0) {
            ps *= 0.5; // make smaller while shaking
        }

        stroke(p.r, p.g, p.b);
        ellipse(p.x, p.y, ps, ps);
    }
    endShape(CLOSE);

    zoff += noiseInc;
    angle += oscSpeed;
}

/**
 * Checks if the letter point 'p' is near any fingertip of any detected hand.
 */
function handOverPoint(p) {
    if (hands.length === 0) return false;

    const detectionRadius = 30;

    for (let hand of hands) {
        for (let i of FINGERTIP_INDICES) {
            let kp = hand.keypoints[i];
            
            if (kp) {
                // Map ML5 coordinates to canvas coordinates
                let mappedX = map(kp.x, 0, video.width, 0, width);
                let mappedY = map(kp.y, 0, video.height, 0, height);

                if (dist(mappedX, mappedY, p.x, p.y) < detectionRadius) return true;
            }
        }
    }
    return false;
}

/**
 * Detects flick by calculating the speed of the combined average position of ALL fingertips
 * across ALL detected hands.
 */
function detectHandFlick() {
    flickActive = false;

    if (hands.length === 0) {
        prevFingertipX = null;
        prevFingertipY = null;
        return;
    }

    let currentTotalX = 0;
    let currentTotalY = 0;
    let fingertipCount = 0;

    // 1. Sum the position of ALL detected fingertips from ALL hands
    for (let hand of hands) {
        for (let i of FINGERTIP_INDICES) {
            let kp = hand.keypoints[i];
            if (kp) {
                currentTotalX += kp.x; 
                currentTotalY += kp.y;
                fingertipCount++;
            }
        }
    }
    
    // Safety check: need at least a couple of fingertips to calculate movement
    if (fingertipCount < 2) {
        prevFingertipX = null;
        prevFingertipY = null;
        return;
    }

    // 2. Calculate the average position (centroid) of all fingertips
    let currentAvgX = currentTotalX / fingertipCount;
    let currentAvgY = currentTotalY / fingertipCount;
    
    // 3. Calculate speed (distance moved by the centroid)
    if (prevFingertipX !== null && prevFingertipY !== null) {
        // Calculate the total distance (speed) moved between the last frame and the current frame
        let speed = dist(currentAvgX, currentAvgY, prevFingertipX, prevFingertipY);
        
        if (speed > flickSpeedThreshold) { 
            flickActive = true;
        }
    }

    // 4. Update previous positions (using RAW ML5 coordinates)
    prevFingertipX = currentAvgX;
    prevFingertipY = currentAvgY;
}

// capture frozen letter after 10 seconds
function captureLetter() {
    let padding = 50;

    let letterX = width / 2 - bounds.w / 2 - padding;
    let letterY = height / 2 - bounds.h / 2 - padding;
    let w = bounds.w + padding * 2;
    let h = bounds.h + padding * 2;

    // Use get() to capture the area of the canvas where the letter is drawn
    frozenImage = get(letterX, letterY, w, h);
}

function generatePoints() {
    points = [];
    bounds = font.textBounds(letter, 0, 0, fontSize);

    let x = width / 2 - bounds.w / 2;
    let y = height / 2 + bounds.h / 2;

    rawPoints = font.textToPoints(letter, x, y, fontSize, {
        sampleFactor: 0.4,
        simplifyThreshold: 0,
    });

    for (let p of rawPoints) {
        points.push({
            x: p.x,
            y: p.y,
            ox: p.x,
            oy: p.y,
            r: 255,
            g: 255,
            b: 255,
            hovered: false,
            shakeTimer: 0,
        });
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    generatePoints();
}
