
#SvgPlus
SvgPlus is a class that on construction extends itself upon a HTML Element.
There is one parameter to the SvgPlus constructor, either an element, id or tagname.
If a tagname is provided then a new element of that tagname will be created.
```JavaScript
  let element = document.querySelector("div.some-class");
  let plusElement1 = new SvgPlus(element);    // element reference
  let plusElement2 = new SvgPlus("some-id");  // id attribute
  let plusElement3 = new SvgPlus("span");     // tagname
```
SvgPlus has some simple methods to simplify common tasks. For example
```JavaScript
  set styles(obj){} //applies styles (in json form) to the element.
  get styles(){} //returns the set of styles applied using set styles.

  set props(obj){} //applies attributes (in json form) to the element.
  get props(){} //returns the set of attributes applied using set props.
```

By extending the SvgPlus class custom elements can be created. For example
```JavaScript
  class RedSquare extends SvgPlus {

    constructor(el, size){
      super(el);

      this.styles = {
        width: size + "px",
        height: size + "px",
        background: "red"
      }
    }

  }
```
By adding methods to our class we can add more functionality.
```JavaScript
  class RedSquare extends SvgPlus {

    constructor(el){
      super(el);
      this.styles = {
        background: "red"
      };
    }

    set size(size) {
      this._size = size;
      this.styles = {
        width: size + "px",
        height: size + "px"
      }
    }

    get size() {
      return this._size
    }
  }
```
Now we could use a red square in a html document like so
```HTML
<body>
  <div id = "boxes">
  </div>
</body>
<script type = "module">
  import {RedSquare} from "./directory.."
  import {SvgPlus} from "./directory.."

  let boxes = new SvgPlus("boxes");
  let square = new RedSquare();

  boxes.size = 10;

  boxes.appendChild(square);
</script>
```
