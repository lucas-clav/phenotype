//hand tracking
let video;
let handPose;
let hands = [];

//letter settings
let letter = "B";
let fontSize = 300;
let font;
let font2;
let font3;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;
let zoff = 0;
let noiseInc = 0.01;

//ripple movement
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//compression
let maxCompression = 0.25;
let targetScale = 1;
let currentScale = 1;

//noise size
let minSize = 2;
let maxSize = 20;

//letter color
let currentColor;
let colorChanged = false;

//frozen image
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  font2 = loadFont("ABCDiatype-Regular-Trial.otf");
  font3 = loadFont("ABCDiatype-Light-Trial.otf");
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  handPose.detectStart(video, gotHands);

  generatePoints();
  currentColor = color(255);


  setTimeout(captureLetter, 60000);
}

function gotHands(results) {
  hands = results;
}

//fist detection
function isFist(hand) {
  if (!hand || !hand.keypoints) return false;

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

//check fingertips visible
function fingertipsVisible(hand) {
  if (!hand || !hand.keypoints) return false;
  const tips = [4, 8, 12, 16, 20];
  return tips.every((t) => hand.keypoints[t] !== undefined);
}

function draw() {
  background(0);


  if (frozenImage) {
    image(
      frozenImage,
      width / 2 - frozenImage.width / 2,
      height / 2 - frozenImage.height / 2
    );
    return;
  }

  //letter details
  textFont(font);
  strokeWeight(1);
  noFill();

  let centerX = width / 2;
  let centerY = height / 2;

  targetScale = 1;

  let left = hands.find((h) => h.handedness === "Left");
  let right = hands.find((h) => h.handedness === "Right");

  let leftFist = isFist(left) && fingertipsVisible(left);
  let rightFist = isFist(right) && fingertipsVisible(right);

  //trigger compression and color change only when both fists detected
  if (leftFist && rightFist) {
    targetScale = maxCompression;

    //only change color once when fully compressed
    if (currentScale <= maxCompression + 0.01 && !colorChanged) {
      currentColor = color(random(255), random(255), random(255));
      colorChanged = true;
    }
  } else {
    colorChanged = false;
  }

  currentScale = lerp(currentScale, targetScale, 0.1);

  if (currentScale > maxCompression + 0.01) {
    currentColor = color(255);
  }

  beginShape();
  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    //ripple
    let waveOffset = i * waveDelay;
    let localAmp = baseAmp + waveStrength * 0.1;

    let oscX = p.ox + localAmp * sin(angle + waveOffset);
    let oscY = p.oy + localAmp * cos(angle + waveOffset);

    //compression
    let compressedX = centerX + (oscX - centerX) * currentScale;

    //easing
    p.x = lerp(p.x, compressedX, 0.15);
    p.y = lerp(p.y, oscY, 0.15);

    stroke(currentColor);
    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let ps = map(n, 0, 1, minSize, maxSize);
    ellipse(p.x, p.y, ps, ps);
  }
  endShape(CLOSE);

  angle += oscSpeed;
  zoff += noiseInc;
}

//capture frozen letter
function captureLetter() {
  let padding = 50;

  let letterX = width / 2 - bounds.w / 2 - padding;
  let letterY = height / 2 - bounds.h / 2 - padding;
  let w = bounds.w + padding * 2;
  let h = bounds.h + padding * 2;

  frozenImage = get(letterX, letterY, w, h);
}

//letter to points
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
