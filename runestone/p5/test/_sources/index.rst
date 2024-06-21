=====================
p5 Tests
=====================

Default Settings
-----------------

.. p5:: using-defaults-demo

    function setup() {
      createCanvas(200, 200);
    }

    function draw() {
      background(255);
      fill(0);
      ellipse(mouseX, mouseY, 50, 50);
    }

Setting Dimensions
-------------------

.. p5:: custom-dimensions-demo
    :width: 350
    :height: 375

    function setup() {
      createCanvas(300, 250);
    }

    function draw() {
      for (let i=0; i<width; i+= 5) {
        for (let j=0; j<height; j+= 5) {
          fill(int(random(255)), int(random(255)), int(random(255)));
          noStroke();
          rect(i, j, 5, 5);
        }
      }
    }

Autoplay
---------

.. p5:: autoplay-demo
    :width: 400
    :height: 400
    :autoplay:


    function setup() {
      createCanvas(350, 300);
    }

    function draw() {
      background(255);
      fill(0);
      ellipse(mouseX, mouseY, 50, 50);
    }




