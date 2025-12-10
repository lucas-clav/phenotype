//body tracking
let video;
let bodyPose;
let poses = [];
let prevBodyX = 0;
let prevBodyY = 0;
let colorTimer = 0;

// letter settings
let letter = "H";
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

// color of the letter
let currentColor;

// screenshot effect
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  angleMode(DEGREES);
  generatePoints();

  currentColor = color(random(255), random(255), random(255));

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  bodyPose.detectStart(video, (results) => (poses = results));

  // capture the letter after 1 minute
  setTimeout(captureLetter, 60000);
}

function draw() {
  background(0);

  let centerX = width / 2;
  let centerY = height / 2;

  //body sway
  let armPoints = [];
  let swayX = 0;
  let swayY = 0;

  if (poses.length > 0) {
    let keypoints = poses[0].keypoints;
    let armIndices = [5, 6, 7, 8, 9, 10];
    armPoints = armIndices
      .map((i) => keypoints[i])
      .filter((kp) => kp !== undefined);

    if (armPoints.length > 0) {
      let bodyX =
        armPoints.reduce((sum, kp) => sum + kp.x, 0) / armPoints.length;
      let bodyY =
        armPoints.reduce((sum, kp) => sum + kp.y, 0) / armPoints.length;

      let dx = bodyX - prevBodyX;
      let dy = bodyY - prevBodyY;

      colorTimer++;
      if (dx * dx + dy * dy > 25 && colorTimer > 10) {
        currentColor = color(random(255), random(255), random(255));
        colorTimer = 0;
      }

      swayX = bodyX - width / 2;
      swayY = bodyY - height / 2;

      prevBodyX = bodyX;
      prevBodyY = bodyY;
    }
  }

  if (frozenImage) {
    image(
      frozenImage,
      width / 2 - frozenImage.width / 2,
      height / 2 - frozenImage.height / 2
    );
    return;
  }

  textFont(font);
  strokeWeight(1);
  noFill();
  stroke(currentColor);

  beginShape();
  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    //ripple
    let phaseOffset = i * waveDelay;
    let localAmp = baseAmp + waveStrength * 0.2;
    let oscX = p.ox + localAmp * sin(angle + phaseOffset);
    let oscY = p.oy + localAmp * cos(angle + phaseOffset);

    //stretch + glide
    if (armPoints.length > 0) {
      let dirX = oscX - centerX;
      let dirY = oscY - centerY;

      oscX += dirX * (swayX / width) * 1.2;
      oscY += dirY * (swayY / height) * 1.2;

      oscX += swayX * 0.15;
      oscY += swayY * 0.15;
    }

    //eased motion
    p.x = lerp(p.x, oscX, 0.15);
    p.y = lerp(p.y, oscY, 0.15);

    //perlin noise
    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let ps = map(n, 0, 1, minSize, maxSize);

    ellipse(p.x, p.y, ps, ps);
  }
  endShape(CLOSE);

  zoff += noiseInc;
  angle += oscSpeed;
}

//capture letter
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
