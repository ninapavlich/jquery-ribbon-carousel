# jquery-ribbon-carousel

[View a simple demo here](http://htmlpreview.github.io/?https://github.com/ninapavlich/jquery-ribbon-carousel/blob/master/example.html)

![alt text](https://raw.githubusercontent.com/ninapavlich/jquery-ribbon-carousel/master/docs/screenshot.png "Very Simple Screenshot")

## Initialization

**Example Markup**

    <div class="ribbon-carousel">    
            <ul>
                <li>                
                    <a href="http://www.example.com">
                        <figure>
                            
                            <img src="http://placehold.it/800x450" alt="Image alt" />
                        </figure>
                    </a>
                    <figcaption>
                        Image Caption that contains <a href="http://www.google.com">a link</a>.
                    </figcaption>
                </li>
                <li>
                    <figure>
                        <img src="http://placehold.it/800x450" alt="Image alt" />
                    </figure>
                </li>
                <li>                
                    <a href="http://www.example.com">
                        <figure>
                            <img src="http://placehold.it/800x450" alt="Image alt" />
                        </figure>
                    </a>
                </li>
            </ul>            
        </div>

**Javascript**

    <script>
        $('.ribbon-carousel').ribbonCarousel({
            'autoPlay':false
        });
    </script>
    

## Options

**mobileBreak:767**
Window width in pixels at which point to mobile display

**autoPlay:false**
Auto-play carousel

**autoPlayInterval:5000**
Seconds between slides if auto-play is turned on

**useAnchors:false**
Set window hash value; gives each slides a unique URL

**pageAnchorPrefix:'slide'**
Window hash prefix used if useAnchors is true. For example, if the second slide is selected, the window url would be: http://www.example.com/#slide2

**themeClass:'ribbon-carousel-theme-default'**
The css class to add to the container
