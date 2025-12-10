//*rotate head to trigger manipulation

//face tracking
let video;
let faceMesh;
let faces = [];

//letter settings
let letter = "F";
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

//ripple
let baseAmp = 5;
let waveStrength = 20;
let waveDelay = 15;
let oscSpeed = 2;

//screenshot
let frozenImage = null;

function preload() {
  font = loadFont("Movement-DirectThin.otf");
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  angleMode(DEGREES);

  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
  faceMesh.detectStart(video, gotFaces);

  generatePoints();

  setTimeout(captureLetter, 60000);
}

function gotFaces(results) {
  faces = results;
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
  let radius = 150;

  //face position (nose tip as center)
  let fx = width / 2;
  let fy = height / 2;
  if (faces.length > 0) {
    let face = faces[0];
    let nose = face.keypoints[1];
    fx = nose.x;
    fy = nose.y;
  }

  beginShape();
  for (let i = 0; i < points.length; i++) {
    let p = points[i];

    //distance from face
    let d = dist(fx, fy, p.ox, p.oy);
    let proximity = constrain(1 - d / radius, 0, 1);

    //perlin noise
    let n = noise(p.ox * 0.01, p.oy * 0.01, zoff);
    let ps = map(n, 0, 1, 2, 20);

    //ripple oscillation
    let waveOffset = i * waveDelay;
    let localAmp = baseAmp + waveStrength * proximity;

    let oscX = p.ox + localAmp * sin(angle + waveOffset);
    let oscY = p.oy + localAmp * cos(angle + waveOffset);

    //ease in
    p.x = lerp(p.x, oscX, 0.15);
    p.y = lerp(p.y, oscY, 0.15);

    //color change near face
    if (proximity > 0.4 && !p.hovered) {
      p.r = random(255);
      p.g = random(255);
      p.b = random(255);
      p.hovered = true;
    } else if (proximity <= 0.4) {
      p.r = lerp(p.r, 255, 0.05);
      p.g = lerp(p.g, 255, 0.05);
      p.b = lerp(p.b, 255, 0.05);
      if (abs(p.r - 255) < 1 && abs(p.g - 255) < 1 && abs(p.b - 255) < 1) {
        p.hovered = false;
      }
    }

    stroke(p.r, p.g, p.b);
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

//generate points
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
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generatePoints();
}
