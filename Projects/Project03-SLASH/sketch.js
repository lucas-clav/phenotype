//*Laban movement: slash w/ screenshot effect

//arm variables
let video;
let bodyPose;
let poses = [];
let prevKeypoints = [];
let motionThreshold = 10;

//letter settings
let letter = "C";
let fontSize = 300;
let font;
let font2;
let font3;
let points = [];
let rawPoints = [];
let bounds;
let angle = 0;

//ripple
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//perlin noise
let zoff = 0;
let noiseInc = 0.01;
let minSize = 2;
let maxSize = 20;

//slash
let slashRadius = 20;

//reset
let resetTimer = null;
let resetting = false;

//screenshot
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true });
}

function gotPoses(results) {
  poses = results;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  bodyPose.detectStart(video, gotPoses);

  generatePoints();

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

  //letter details
  textFont(font);
  strokeWeight(1);
  noFill();
  stroke(255);

  let armMotionPoints = [];
  const Indices = [5, 6, 7, 8, 9, 10, 11, 12];

  //detect arm movement
  if (poses.length > 0) {
    let pose = poses[0];

    if (prevKeypoints.length === 0) {
      prevKeypoints = pose.keypoints.map((kp) => ({ x: kp.x, y: kp.y }));
    }

    for (let i of Indices) {
      let kp = pose.keypoints[i];
      if (kp.confidence > 0.1) {
        let movement = dist(kp.x, kp.y, prevKeypoints[i].x, prevKeypoints[i].y);
        if (movement > motionThreshold) {
          armMotionPoints.push({ x: kp.x, y: kp.y });
        }
      }
    }

    prevKeypoints = pose.keypoints.map((kp) => ({ x: kp.x, y: kp.y }));
  }

  let aliveCount = 0;

  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    //fade in during reset
    if (resetting) {
      p.alpha += 5;
      if (p.alpha >= 255) {
        p.alpha = 255;
        p.alive = true;
      }
    }

    if (!p.alive && p.alpha <= 0) continue;

    //slash kills points
    if (p.alive) {
      for (let sp of armMotionPoints) {
        if (dist(sp.x, sp.y, p.x, p.y) < slashRadius) {
          p.alive = false;
          p.alpha = 255;
          // assign a random color when hit
          p.color = color(random(255), random(255), random(255));
        }
      }
    }

    //fade out
    if (!p.alive && p.alpha > 0 && !resetting) {
      p.alpha -= 20;
      if (p.alpha < 0) p.alpha = 0;
    }

    //ripple
    let waveOffset = i * waveDelay;
    let localAmp = baseAmp + waveStrength * 0.1;

    let rippleX = p.ox + localAmp * sin(angle + waveOffset);
    let rippleY = p.oy + localAmp * cos(angle + waveOffset);

    //perlin noise
    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let ps = map(n, 0, 1, minSize, maxSize); // ellipse size from noise

    //combine ripple (movement) with noise (size effect)
    p.x = lerp(p.x, rippleX, 0.15);
    p.y = lerp(p.y, rippleY, 0.15);

    if (p.alive) aliveCount++;

    //draw with random color if assigned
    if (p.color) {
      stroke(red(p.color), green(p.color), blue(p.color), p.alpha);
    } else {
      stroke(255, p.alpha);
    }
    noFill();
    ellipse(p.x, p.y, ps, ps);
  }

  angle += oscSpeed;
  zoff += noiseInc;

  // letter gone → reset
  // if (aliveCount === 0 && !resetTimer && !resetting) {
  //   resetTimer = setTimeout(startReset, 3000);
  // }
}

function captureLetter() {
  let padding = 50;

  let letterX = width / 2 - bounds.w / 2 - padding;
  let letterY = height / 2 - bounds.h / 2 - padding;
  let w = bounds.w + padding * 2;
  let h = bounds.h + padding * 2;

  frozenImage = get(letterX, letterY, w, h);
}

function startReset() {
  resetting = true;
  resetTimer = null;

  for (let p of points) {
    p.alpha = 0;
    p.alive = false;
    p.color = null;
    p.x = p.ox;
    p.y = p.oy;
  }

  let fadeInterval = setInterval(() => {
    let done = points.every((pt) => pt.alpha >= 255);
    if (done) {
      resetting = false;
      clearInterval(fadeInterval);
    }
  }, 30);
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
      alive: true,
      alpha: 255,
      color: null,
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generatePoints();
}
