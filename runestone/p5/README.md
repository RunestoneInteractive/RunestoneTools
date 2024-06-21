<h2>p5</h2>

<pre>.. p5:: first-demo
    :width: 250
    :height: 250
    :autoplay:


    function setup() {
      createCanvas(200, 200);
    }

    function draw() {
      background(255);
      fill(0);
      ellipse(mouseX, mouseY, 50, 50);
    } 
</pre>

Everything inside of the `p5` directive, including whitespace, will be included in the page and rendered with the p5.js-widget.

 <ul>
    <li>`id` Must be unique in the document.</li>
    <li>`autoplay` If present, the sketch will start playing automatically.</li>
    <li>`height` The height of the widget (and consequently the sketch preview pane too) defaults to 300px and can be changed via the height attribute.</li>
    <li>`width` The width of the sketch preview pane defaults to 150px and can be set via the width attribute.</li>
    <!-- <li>`data-p5-version` It's possible to optionally specify the p5 version to use in your widget via the data-p5-version attribute. A complete list of available versions can be found at cdnjs.com/libraries/p5.js.</li> -->
    <!-- <li>`data-base-url` By default, the widget will set the base URL of the sketch to the URL of the page embedding the widget. f you'd like to override this default, you can specify a custom base URL with the data-base-url attribute.</li> -->
    <!-- <li>`src` The src attribute can be used to load the widget's content from an external file instead of specifying it inline.</li> -->
 </ul>
