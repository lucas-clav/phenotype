//hand tracking
let video;
let handPose;
let hands = [];

//body tracking
let bodyPose;
let poses = [];
let prevWristDist = 0;
let punchThreshold = 25;

//letter settings
let letter = "A";
let fontSize = 300; // Scaled down for grid container
let font;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;

//ripple movement
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//noise settings
let zoff = 0;
let noiseInc = 0.01;
let minSize = 2;
let maxSize = 20;

//punch interaction
let punchRadius = 60; // Adjusted for small container
let punchGrowSize = 150; // Adjusted for small container
let cooldownDecay = 0.75;

//screenshot freeze
let frozenImage = null;
let freezeDelay = 60000;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  handPose = ml5.handPose({ flipped: true });
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);
  generatePoints();

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  // Mute the video element to satisfy browser autoplay policies in iframes
  video.elt.muted = true;

  handPose.detectStart(video, (results) => (hands = results));
  bodyPose.detectStart(video, (results) => (poses = results));

  setTimeout(captureLetter, freezeDelay);
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

  // Removed UI text block

  let punchPoint = detectPunch();

  beginShape();
  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    //ripple
    let phaseOffset = i * waveDelay;
    let localAmp = baseAmp + waveStrength * 0.1;
    let oscX = p.ox + localAmp * sin(angle + phaseOffset);
    let oscY = p.oy + localAmp * cos(angle + phaseOffset);

    p.x = lerp(p.x, oscX, 0.1);
    p.y = lerp(p.y, oscY, 0.1);

    //noise
    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let baseSize = map(n, 0, 1, minSize, maxSize);

    //punch detected
    if (punchPoint) {
      // Map ML5 coordinates (from video) to Canvas coordinates (from iframe)
      let mappedPunchX = map(punchPoint.x, 0, video.width, 0, width);
      let mappedPunchY = map(punchPoint.y, 0, video.height, 0, height);

      let d = dist(mappedPunchX, mappedPunchY, p.x, p.y);

      if (d < punchRadius) {
        let influence = 1 - d / punchRadius;
        let targetInflation = lerp(baseSize, punchGrowSize, influence);

        p.size = lerp(p.size, targetInflation, 0.3);

        //random color
        p.col = color(random(255), random(255), random(255));

        p.cooldown = 1;
      }
    }

    //cooldown decay
    if (p.cooldown > 0.05) {
      p.size = lerp(p.size, baseSize, 0.02);
      p.cooldown *= cooldownDecay;
    } else {
      //fade back to white
      p.col = lerpColor(p.col, color(255), 0.1);
      p.size = lerp(p.size, baseSize, 0.1);
    }

    noFill();
    stroke(p.col);
    ellipse(p.x, p.y, p.size, p.size);
  }
  endShape();

  zoff += noiseInc;
  angle += oscSpeed;
}

//punch detector
function detectPunch() {
  let wristX = null;
  let wristY = null;
  let punchDetected = false;

  if (poses.length > 0) {
    let pose = poses[0];
    let leftWrist = pose.keypoints[9];
    let rightWrist = pose.keypoints[10];

    let targetWrist = null;

    // Check left punch
    if (leftWrist && pose.keypoints[7]) {
      let leftElbow = pose.keypoints[7];
      let wristDist = dist(leftWrist.x, leftWrist.y, leftElbow.x, leftElbow.y);
      let speed = wristDist - prevWristDist;

      if (speed > punchThreshold) {
        targetWrist = leftWrist;
        punchDetected = true;
      }
      prevWristDist = wristDist;
    }

    // Check right punch
    if (rightWrist && pose.keypoints[8]) {
      let rightElbow = pose.keypoints[8];
      let wristDist = dist(rightWrist.x, rightWrist.y, rightElbow.x, rightElbow.y);
      let speed = wristDist - prevWristDist;

      if (speed > punchThreshold) {
        targetWrist = rightWrist;
        punchDetected = true;
      }
      prevWristDist = wristDist;
    }

    if (targetWrist) {
      wristX = targetWrist.x;
      wristY = targetWrist.y;
    }
  }

  if (punchDetected && wristX !== null) {
    return { x: wristX, y: wristY };
  }

  return null;
}

//screenshot
function captureLetter() {
  let padding = 20; // Reduced padding for smaller frame

  let letterX = width / 2 - bounds.w / 2 - padding;
  let letterY = height / 2 - bounds.h / 2 - padding;
  let w = bounds.w + padding * 2;
  let h = bounds.h + padding * 2;

  frozenImage = get(letterX, letterY, w, h);
}

function generatePoints() {
  points = [];
  
  // Use the global fontSize (100)
  const scaledFontSize = fontSize;
  bounds = font.textBounds(letter, 0, 0, scaledFontSize);

  let x = width / 2 - bounds.w / 2;
  let y = height / 2 + bounds.h / 2;

  rawPoints = font.textToPoints(letter, x, y, scaledFontSize, {
    sampleFactor: 0.4,
    simplifyThreshold: 0,
  });

  for (let p of rawPoints) {
    points.push({
      x: p.x,
      y: p.y,
      ox: p.x,
      oy: p.y,
      size: 5,
      col: color(255),
      cooldown: 0,
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generatePoints();
}
