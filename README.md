# jquery-ribbon-carousel

[View a simple demo here](https://cdn.rawgit.com/ninapavlich/jquery-ribbon-carousel/master/example.html)

[View the carousel in the wild here](http://www.chrisharburg.com/)



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


**Required Libraries**

    <script src="js/vendor/jquery-1.11.2.min.js"></script>

    <!-- Required for draggability -->
    <script src="js/vendor/jquery-ui.min.js"></script>
    <script src="js/vendor/jquery.ui.touch-punch.min.js"></script>

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

**maxAutoPlayIntervals:0**
Number of times that auto-play runs before pausing. Auto-play will play indefinitely if set to 0.

**useAnchors:false**
Update window hash so that specific slides can be bookmarkable.

**pageAnchorPrefix:'slide'**
Window hash prefix used if useAnchors is true. For example, if the second slide is selected, the window url would be: http://www.example.com/#slide2

**themeClass:'ribbon-carousel-theme-default'**
The css class to add to the container

**aspectRatio:null**
Aspect ratio used -- based on width of slide container -- to establish the height of the slides. If left null, it will calculate the average aspect ratio of all the slides and use that.