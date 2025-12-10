//hand tracking
let video;
let handPose;
let hands = [];

//letter settings
let letter = "D";
let fontSize = 300;
let font;
let font2;
let font3;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;

//ripple movement settings
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//compression logic
let maxCompression = 0.2;
let smoothedCompression = 1;

//noise settings
let zoff = 0;
let noiseInc = 0.02;
let minSize = 2;
let maxSize = 20;

//color control
let currentColor = { r: 255, g: 255, b: 255 };
let targetColor = { r: 255, g: 255, b: 255 };
let hasTriggeredColor = false;

//screenshot effect
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  handPose = ml5.handPose({ flipped: true });
}

function gotHands(results) {
  hands = results;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  angleMode(DEGREES);
  generatePoints();

  video = createCapture(VIDEO, { flipped: true });
  video.hide();
  handPose.detectStart(video, gotHands);

  // automatically capture screenshot after 1 minute
  setTimeout(captureLetter, 60000);
}

function draw() {
  if (frozenImage) {
    background(0);
    image(
      frozenImage,
      width / 2 - frozenImage.width / 2,
      height / 2 - frozenImage.height / 2
    );
    return;
  }

  background(0);

  //hand logic
  let compression = 1;
  let isWrung = false;

  if (hands.length > 0) {
    let left = hands.find((h) => h.handedness === "Left");
    let right = hands.find((h) => h.handedness === "Right");

    if (left && right) {
      let leftFist = isFist(left);
      let rightFist = isFist(right);

      if (leftFist && rightFist) {
        let leftAngle = handRotation(left);
        let rightAngle = handRotation(right);

        let twistAmount = abs(leftAngle - rightAngle);
        twistAmount = constrain(twistAmount, 0, 90);

        compression = map(twistAmount, 0, 90, 1, maxCompression);
        compression = constrain(compression, maxCompression, 1);

        if (compression < 1) isWrung = true;
      }
    }
  }

  //smooth compression
  if (compression < smoothedCompression) {
    smoothedCompression = lerp(smoothedCompression, compression, 0.02);
  } else {
    smoothedCompression = lerp(smoothedCompression, compression, 0.5);
  }

  //color logic
  if (isWrung) {
    if (!hasTriggeredColor) {
      targetColor = {
        r: random(255),
        g: random(255),
        b: random(255),
      };
      hasTriggeredColor = true;
    }
  } else {
    targetColor = { r: 255, g: 255, b: 255 };
    hasTriggeredColor = false;
  }

  //smooth color lerp
  currentColor.r = lerp(currentColor.r, targetColor.r, 0.05);
  currentColor.g = lerp(currentColor.g, targetColor.g, 0.05);
  currentColor.b = lerp(currentColor.b, targetColor.b, 0.05);

  //draw letter
  let letterCenter = { x: width / 2, y: height / 2 };

  stroke(currentColor.r, currentColor.g, currentColor.b);
  strokeWeight(1);
  noFill();

  beginShape();
  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    let phaseOffset = i * waveDelay;

    let localAmp = baseAmp + waveStrength * 0.1;
    let oscX = p.ox + localAmp * sin(angle + phaseOffset);
    let oscY = p.oy + localAmp * cos(angle + phaseOffset);

    p.x = lerp(p.x, oscX, 0.1);
    p.y = lerp(p.y, oscY, 0.1);

    let compressedY =
      letterCenter.y + (p.y - letterCenter.y) * smoothedCompression;

    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let ps = map(n, 0, 1, minSize, maxSize);

    ellipse(p.x, compressedY, ps, ps);
  }
  endShape(CLOSE);

  // animate movement
  zoff += noiseInc;
  angle += oscSpeed;
}

function captureLetter() {
  let padding = 50;
  let letterX = width / 2 - bounds.w / 2 - padding;
  let letterY = height / 2 - bounds.h / 2 - padding;
  let w = bounds.w + padding * 2;
  let h = bounds.h + padding * 2;
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
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generatePoints();
}

//fist detection
function isFist(hand) {
  const wrist = hand.keypoints[0];
  const tips = [4, 8, 12, 16, 20];
  let curled = 0;
  for (let t of tips) {
    let tip = hand.keypoints[t];
    if (tip) {
      let d = dist(wrist.x, wrist.y, tip.x, tip.y);
      if (d < 80) curled++;
    }
  }
  return curled >= 4;
}

//hand rotation
function handRotation(hand) {
  let wrist = hand.keypoints[0];
  let indexMCP = hand.keypoints[5];
  return atan2(indexMCP.y - wrist.y, indexMCP.x - wrist.x);
}
