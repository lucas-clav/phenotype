//letter settings
let letter = "G";
let fontSize = 300;
let font;
let font2;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;

//ripple movement
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//hand tracking
let video;
let handPose;
let hands = [];

//scale animation
let targetScale = 1;
let currentScale = 1;

//letter color
let letterColor;
let leftPinchPrev = false;

//noise settings
let zoff = 0;
let noiseInc = 0.01;
let minSize = 2;
let maxSize = 20;

//screenshot
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  angleMode(DEGREES);

  letterColor = color(255);

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  handPose.detectStart(video, gotHands);

  generatePoints();


  setTimeout(captureLetter, 60000);
}

function gotHands(results) {
  hands = results;
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

  noFill();
  stroke(letterColor);

  let right = null;
  let left = null;

  //find hands
  for (let hand of hands) {
    if (hand.handedness === "Right") {
      right = {
        thumb: hand.thumb_tip,
        fingers: [
          hand.index_finger_tip,
          hand.middle_finger_tip,
          hand.ring_finger_tip,
          hand.pinky_finger_tip,
        ],
      };
    }
    if (hand.handedness === "Left") {
      left = hand;
    }
  }

  //right hand controls scale
  if (right) {
    let thumb = right.thumb;
    let distances = right.fingers.map((f) => dist(thumb.x, thumb.y, f.x, f.y));
    let avgD = distances.reduce((a, b) => a + b, 0) / distances.length;
    targetScale = map(avgD, 10, 220, 0.5, 2.0);
    targetScale = constrain(targetScale, 0.5, 2.0);
  } else {
    targetScale = 1;
  }

  currentScale = lerp(currentScale, targetScale, 0.08);

  //left hand pinch → color change
  let leftPinch = false;

  if (left) {
    let thumb = left.thumb_tip;
    let fingerTips = [
      left.index_finger_tip,
      left.middle_finger_tip,
      left.ring_finger_tip,
      left.pinky_finger_tip,
    ];

    for (let f of fingerTips) {
      if (dist(f.x, f.y, thumb.x, thumb.y) < 40) {
        leftPinch = true;
        break;
      }
    }
  }

  if (leftPinch && !leftPinchPrev) {
    letterColor = color(random(255), random(255), random(255));
  }
  leftPinchPrev = leftPinch;

  //draw letter with ripple + scale + noise
  let centerX = width / 2;
  let centerY = height / 2;

  beginShape();

  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let phaseOffset = i * waveDelay;

    //ripple
    let oscX = p.ox + (baseAmp + waveStrength * 0.1) * sin(angle + phaseOffset);
    let oscY = p.oy + (baseAmp + waveStrength * 0.1) * cos(angle + phaseOffset);

    //scale transform
    let scaledX = centerX + (oscX - centerX) * currentScale;
    let scaledY = centerY + (oscY - centerY) * currentScale;

    //eased movement
    p.x = lerp(p.x, scaledX, 0.15);
    p.y = lerp(p.y, scaledY, 0.15);

    //perlin noise
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
  //larger padding to accommodate for max size C
  let padding = 150;
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
