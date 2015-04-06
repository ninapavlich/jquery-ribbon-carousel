/*!
 * nina@ninalp.com
 */


// the semi-colon before the function invocation is a safety
// net against concatenated scripts and/or other plugins
// that are not closed properly.
;(function ( $, window, document, undefined ) {

    // undefined is used here as the undefined global
    // variable in ECMAScript 3 and is mutable (i.e. it can
    // be changed by someone else). undefined isn't really
    // being passed in so we can ensure that its value is
    // truly undefined. In ES5, undefined can no longer be
    // modified.

    // window and document are passed through as local
    // variables rather than as globals, because this (slightly)
    // quickens the resolution process and can be more
    // efficiently minified (especially when both are
    // regularly referenced in your plugin).

    // Create the defaults once
    var pluginName = "ribbonCarousel",
        defaults = {
            mobileBreak:767,
            autoPlay:true,
            autoPlayDelay:15000,
            autoPlayInterval:15000,
            containerWidthPortion:1,
            pageAnchorPrefix:'slide',
            themeClass:'ribbon-carousel-theme-default'

        };

    // The actual plugin constructor
    function RibbonCarousel( element, options ) {
        this.element = element;

        // jQuery has an extend method that merges the
        // contents of two or more objects, storing the
        // result in the first object. The first object
        // is generally empty because we don't want to alter
        // the default options for future instances of the plugin
        this.options = $.extend( {}, defaults, options) ;
        this.ready = false;

        this.mobile_break = this.options.mobileBreak;
        this._defaults = defaults;
        this._name = pluginName;
        this._original_slides = [];
        this.current_index = 0;
        this.previous_index = 0;
        this.previous_rendered_index = -1;
        this.dot_index = 0;
        this.min_index = 0;
        this.max_index = null;
        this.set_length = null;
        this.can_animate = true;


        
        this.autoprogress_timeout = -1;


        //Dynamically created
        this.slides_container = null;

        this.carousel_left = null;
        this.carousel_left_container = null;
        this.carousel_right = null;
        this.carousel_right_container = null;

        this.controls_container = null;
        this.carousel_pagination = null;
        this.carousel_arrows = null;

        this.init();
    }

    RibbonCarousel.prototype = {

        init: function() {
            var parent = this;
            var slides = $(this.element).find("li");
            this.set_length = $(slides).length;
            this.max_index = this.set_length - 1;

            if(this.ready==false){                
                var inited_images = $(slides).find("img[data-inited='true']")
                if(slides.length == inited_images.length){
                    this.ready = true;
                }else{

                    $(slides).each(function(index, slide){
                        var image = $(slide).find("img")[0];
                        var isMeasured = parent.isImageMeasured(image);
                        if(isMeasured == false){
                            parent.measureImage(image)   
                            return false;  
                        }                        
                    })
                }
            }
            if(this.ready==false){
                return;
            }
            $(this.element).addClass('ready');
            $(this.element).addClass(this.options.themeClass);
            
            var carousel_contents = $(this.element).find("ul")[0];

            
            //Create containers
            $('<div class="controls"><div class="container"></div></div>').insertBefore(carousel_contents);
            this.controls_container = $(this.element).find(".controls > .container");
            $('<div class="slides"><div class="container"></div></div>').insertBefore(carousel_contents);
            this.slides_container = $(this.element).find(".slides > .container");


            //Clone original slides and hide
            $(carousel_contents).find("li").each(function(index, item){
                parent._original_slides[index] = $(item).clone();                
            })            
            $(carousel_contents).css("display", "none");


            //populate controls container
            var arrows="<ul class='carousel-arrows'><li><a href='#' class='next'><span>Next</span></a></li><li><a href='#' class='previous'><span>Previous</span></a></li></ul>";
            var pagination = "<ul class='carousel-pagination'>";
            $(slides).each(function(index, slide){
                pagination += "<li><a href='#"+parent.options.pageAnchorPrefix+(index+1)+"'><span>Slide "+(index+1)+"</span></a></li>";
            });
            pagination += "</ul>";
            $(this.controls_container).append($(pagination+arrows));
            

            $(this.slides_container).append($("<div class='carousel-left-container'><ul class='carousel-left'></ul></div>"));
            $(this.slides_container).append($("<div class='carousel-center-container'><ul class='carousel-center'></ul></div>"));
            $(this.slides_container).append($("<div class='carousel-right-container'><ul class='carousel-right'></ul></div>"));


            this.carousel_left = $(this.slides_container).find("ul.carousel-left")[0]
            this.carousel_left_container = $(this.element).find(".carousel-left-container")[0]

            this.carousel_center = $(this.slides_container).find("ul.carousel-center")[0]
            this.carousel_center_container = $(this.element).find(".carousel-center-container")[0]

            this.carousel_right = $(this.slides_container).find("ul.carousel-right")[0]
            this.carousel_right_container = $(this.element).find(".carousel-right-container")[0]

            this.carousel_pagination = $(this.controls_container).find("ul.carousel-pagination")[0]
            this.carousel_arrows = $(this.controls_container).find(".carousel-arrows")[0]


            



            var initial_slide_index = this.getIndexFromHash();
            if(initial_slide_index){
                this.current_index = initial_slide_index;                
            }


            // this.measureContents();
            this.resizeImages();
            this.addListeners()
            //this.removeListeners()

            this.setIndex(this.current_index);

        },
        setIndex: function(target_index) {
            // console.log("Set index: "+target_index)
            if(this.can_animate == false){
                this.next_index = target_index;
                //block click, currently animating
                return;
            }

            this.previous_index = this.current_index;
            this.current_index = Math.max(Math.min(this.max_index, target_index), this.min_index)
            
            //console.log("the target index is "+target_index);
            //console.log("the current index is "+this.current_index);
            //console.log("the max index is "+this.max_index);
            
            this.render();


        
        
            if(this.options.autoPlay==true){
                var parent = this;
                clearTimeout(this.autoprogress_timeout);
                this.autoprogress_timeout = setTimeout(function(){
                    var next_index = parent.getIndexAfter(parent.current_index);
                    document.location.hash = parent.options.pageAnchorPrefix+(next_index+1);                    
                }, this.options.autoPlayInterval);                    
            }
            
            
        },
        getIndexFromHash:function(){
            var hash = document.location.hash;
            var dePrefixed = hash.replace("#"+this.options.pageAnchorPrefix, '');
            var index = parseInt(dePrefixed);
            if(isNaN(index)){
                index = 0;
            }
            if(index>0){
                index = index-1;
            }
            return index;
        },
        render: function() {
            var parent = this; 

            //Handle logic for Animating Center Item
            var columnWidth = this.getImageColumnWidth();
            var containerWidth = this.getContainerWidth();

            // console.log("columnWidth: "+columnWidth+" containerWidth: "+containerWidth)
            var animationSpeed = 400;
            

            var center_indexes = this.getCenterIndexes(this.current_index, this.set_length);

            var distances = this.getRelativeIndexes(this.current_index, this.previous_index, this.set_length);
            var rightDistance = distances[0];
            var leftDistance = distances[1];
            var moving_right = rightDistance < leftDistance;
            var moving_distance = moving_right? rightDistance : leftDistance;
                        

            var center_index = Math.floor(center_indexes.length/2);
            var target_offset = 0-(columnWidth*center_index);
            var starting_offset = moving_right? (target_offset + (moving_distance*columnWidth)) : (target_offset - (moving_distance*columnWidth));

            var target_offset_right = target_offset - columnWidth;
            var starting_offset_right = starting_offset - columnWidth;

            var target_offset_left = target_offset;// + columnWidth;
            var starting_offset_left = target_offset;//+ columnWidth;
            
            var is_new_render = this.previous_rendered_index != this.current_index;

            
            // console.log("indexes for "+this.current_index+" are "+center_indexes)
            

            
            if(is_new_render ){

                this.setImages(center_indexes, this.carousel_center, false);
                this.setImages(center_indexes, this.carousel_right, false);
                this.setImages(center_indexes, this.carousel_left, false);

                this.can_animate = false;
                $( this.carousel_center ).css("left", starting_offset+"px");
                $( this.carousel_center ).animate({ left:target_offset }, animationSpeed);

                $( this.carousel_right ).css("left", starting_offset_right+"px");
                $( this.carousel_right ).animate({ left:target_offset_right }, animationSpeed);

                $( this.carousel_left ).css("left", starting_offset+"px");
                $( this.carousel_left ).animate({ left:target_offset }, animationSpeed);


                this.can_animate = false;
                setTimeout(function(){
                    parent.can_animate = true
                }, animationSpeed+100)


                if(this.current_index != this.previous_index){                    
                    $(this.carousel_pagination).find("li:nth-child("+(this.previous_index+1)+") a").removeClass('active');
                }            
                $(this.carousel_pagination).find("li:nth-child("+(this.current_index+1)+") a").addClass('active');

                this.reassignLinks();
                this.resizeImages();
                this.resizeContainers();

            }else{
                //not a new render, just update positions                
                
                this.alignContainers();

            }
            

            
            

            this.previous_rendered_index = this.current_index;

        },
        isImageMeasured: function(image) {

            if( $(image).data('inited') && $(image).data('inited') == true){
                //ugbire
                return true;

            }else{
                
                if( typeof($(image).data('image-width')) !== 'undefined' && 
                    typeof($(image).data('image-width')) !== 'undefined'){
                    //woooohaa, it's already inited!
                    $(image).data('inited', true);
                    
                    return true

                }else{

                    return false;

                }

            }

        },
        measureImage: function(image) {
            var parent = this;
            
            var isMeasured = parent.isImageMeasured(image);
            if(isMeasured==false){

                $("<img/>").attr("src", $(image).attr("src")).load(function() {
                    $(image).data('inited', true);
                    $(image).attr('data-inited', true);
                    $(image).data('image-width', this.width);
                    $(image).attr('data-image-width', this.width);
                    $(image).data('image-height', this.height);
                    $(image).attr('data-image-height', this.height);
                    
                    //todo -- init
                    parent.init();
                });
            }
            
            
        },
        // measureContents: function(){
            
        //     var ww = $(window).width();

        //     if(ww <= this.mobile_break){

        //         var min_mobile_height = 250;
        //         var max_mobile_height = $(window).height()*0.6;
        //         var mobile_height = Math.max(min_mobile_height, max_mobile_height);
        //         $(this.element).find(".carousel-container").height(mobile_height);

        //     }else{

        //         var pad_bottom = 20;
        //         var min_height = 336;
        //         var max_height = min_height;

        //         $(this.element).find("ul.carousel-description > li").each(function(index, item){
        //             var item_height = $(item).outerHeight() + parseInt($(item).css("paddingTop"), 10) + pad_bottom;
        //             max_height = Math.max(max_height, item_height)
        //         })

        //         $(this.element).find(".carousel-container").height(max_height)
        //     }
        // },
        alignContainers:function(){
            var columnWidth = this.getImageColumnWidth();

            var index_list_length = (this.set_length * 2) - 1;

            var center_index = Math.floor(index_list_length/2);
            var target_offset = 0-(columnWidth*center_index);
            var target_offset_right = target_offset - columnWidth;

            $(this.carousel_center).css("left", target_offset+"px");
            $(this.carousel_right).css("left", target_offset_right+"px");
            $(this.carousel_left).css("left", target_offset+"px");
            
        },
        resizeContainers:function(){
            var columnWidth = this.getImageColumnWidth();
            var index_list_length = (this.set_length * 2) - 1;


            var left = (this.set_length) * columnWidth;
            var center_right = index_list_length * columnWidth;

            console.log("LEFT? "+left+" center_right? "+center_right+" columnWidth? "+columnWidth)

            $(this.carousel_left).css("width", left);
            $(this.carousel_right).css("width", center_right);
            $(this.carousel_right_container).css("width", center_right);
            $(this.carousel_center).css("width", center_right);
        },
        resizeImages:function(){
            //for each image, scale to fill its container
            var columnWidth = this.getImageColumnWidth();
            
            $(this.element).find("ul.carousel-left > li").each(function(index, item){
                $(this).width(columnWidth)
            });
            $(this.element).find("ul.carousel-center > li").each(function(index, item){
                $(this).width(columnWidth)
            });
            $(this.element).find("ul.carousel-right > li").each(function(index, item){
                $(this).width(columnWidth)
            });

            this.resizeImageSet( $(this.element).find("ul.carousel-center > li, ul.carousel-left > li, ul.carousel-right > li") );

        },
        resizeImageSet:function(set){
            var parent = this;
            $(set).each(function(index, item){

                var img = $(this).find("img");
                var original_width = $(img).data("image-width");
                var original_height = $(img).data("image-height");
                var container_width = $(this).outerWidth();
                var container_height = $(this).outerHeight();

                // if(parent.options.imageFill){
                    parent.imageFill(img, container_width, container_height, original_width, original_height);    
                // }else{
                //     parent.imageFit(img, container_width, container_height, original_width, original_height);
                // }
                
                
            });
        },
        // imageFit:function(img, container_width, container_height, original_width, original_height){
            
        //     var dx = -0.5 * ((original_width * scale_height)- container_width);
        //     var dy = -0.5 * ((original_height * scale_width)- container_height);

        //     if(scale_height > scale_width){

        //         $(img).css("width", "auto");
        //         $(img).css("height", container_height+"px");
                
        //         $(img).css("margin-left", dx+"px");
        //         $(img).css("margin-top", "0px");

        //     }else{
        //         $(img).css("height", "auto");
        //         $(img).css("width", container_width+"px");
                
        //         $(img).css("margin-top", dy+"px");
        //         $(img).css("margin-left", "0px");
        //     }
        // },
        imageFill:function(img, container_width, container_height, original_width, original_height){
            var scale_width = container_width / original_width;
            var scale_height = container_height / original_height;

            // console.log("scale_width "+scale_width+" to get original width "+original_width+" to match "+container_width);
            // console.log("scale_height "+scale_height+" to get original width "+original_height+" to match "+container_height);

            

            if(scale_height > scale_width){

                $(img).css("width", "auto");
                $(img).css("height", container_height+"px");
                var dx = -0.5 * ((original_width * scale_height)- container_width);
                $(img).css("margin-left", dx+"px");
                $(img).css("margin-top", "0px");

            }else{
                $(img).css("height", "auto");
                $(img).css("width", container_width+"px");
                var dy = -0.5 * ((original_height * scale_width)- container_height);
                $(img).css("margin-top", dy+"px");
                $(img).css("margin-left", "0px");
            }
        },
        getCenterIndexes:function(current_index, set_length){
            return this.getBeforeImageSet(current_index, set_length).concat([current_index]).concat(this.getAfterImageSet(current_index, set_length))
        },
        getAfterImageSet:function(index, len){
            //get the set of half the images "after" the current index
            
            var begin_index = (index + 1) % len;
           
            //turn these into indexes
            var indexes = [];
            for(var k=begin_index; k< begin_index+len-1; k++){                
                var real_index = k%len;
                //console.log("A fake index is "+k+" realindex is "+real_index)
                indexes.push(real_index);
            }
            

            return indexes
        },
        getBeforeImageSet:function(index, len){
            //get the set of half the images "after" the current index
            
            var begin_index = (Math.floor( (index+(len))%len ) + 1)%len;
            
            //turn these into indexes
            var indexes = [];
            for(var k=begin_index; k< begin_index+len-1; k++){                
                var real_index = k%len;
                //console.log("B fake index is "+k+" realindex is "+real_index)
                indexes.push(real_index);
            }

            
            return indexes
        },
        reassignLinks : function(){
            

            //set next and previous 
            var next_index = (this.current_index + 1) % this.set_length;
            var prev_index = (this.current_index + this.set_length - 1) % this.set_length;

            var new_next_url = "#"+this.options.pageAnchorPrefix+(next_index+1);
            var new_prev_url = "#"+this.options.pageAnchorPrefix+(prev_index+1);

            $(this.carousel_arrows).find(".next").attr('href', new_next_url);
            $(this.carousel_arrows).find(".previous").attr('href', new_prev_url);
            

        },
        addListeners: function() {
            //bind click events on the arrows and dots
            var parent = this
            

            
            //normal smooth behavior
            $(this.element).find("li.next a").bind("click", function(e) {

                e.preventDefault();
                e.defaultPrevented
                
                //looping - if the current set index is already at min or max, and the arrow is clicked, modulus gets the remainder instead so the index loops back over its range
                var target_index = (parent.current_index+1)%parent.set_length
                
                
                parent.setIndex(target_index)
                
            });

            $(this.element).find("li.prev a").bind("click", function(e) {
                e.preventDefault();                
            

                var target_index = ((parent.current_index-1)+parent.set_length)%parent.set_length                

                parent.setIndex(target_index)
            });

            $(this.element).find(".progress li").bind("click", function(e) {
                e.preventDefault();
                
                var current_index = ($(this).index())
                parent.setIndex(current_index)
            });



            $(window).bind("resize", function(event){
                // parent.measureContents();
                parent.resizeImages();
                parent.resizeContainers();
                parent.alignContainers();                
            });

            $(window).bind('hashchange', function(event) {
                //detect url from 
                var newIndex = parent.getIndexFromHash();
                parent.setIndex(newIndex);

            });
        },
        addSlideListeners:function(slide){
            //add 
            var parent = this;
            var target_index = $(slide).attr('data-slide');
           
            $(slide).find("a").bind("click", function(e) {
                //e.preventDefault();
                //parent.setIndex(target_index);
                var target = e.target;
                if(e.target.tagName.toUpperCase() == 'IMG'){
                    target = $(target).parent()
                }
                window.location.href = $(target).attr("href");
            });
        },
        removeListeners: function() {
            //unbind click events on the arrows and dots
            $(this.element).find("li.next a").unbind("click");
            $(this.element).find("li.prev a").unbind("click");
            $(this.element).find(".progress li").unbind("click");
        },
        removeSlideListeners:function(slide){
            //remove 
            $(slide).find("a").unbind("click");
        },
        getImageColumnWidth:function(){
            var ww = $(window).width();
            if(ww <= this.mobile_break){
                return ww;
            }
            var w = $(this.slides_container).outerWidth();
            return w * this.options.containerWidthPortion;
        },
        getContainerWidth:function(){
            var w = $(this.slides_container).outerWidth();
            return w;
        },
       
        setImages:function(indexes, container, debug){
            if(debug){console.log("indexes "+indexes);}
            var parent = this;

            $(container).children().each(function(index, item) {
                parent.removeSlide(item);                
            });

            for(var ci=0; ci<indexes.length; ci++){   
                index = indexes[ci];  
                parent.createSlide(index, container);                
            }
            
        },
        createSlide:function(index, container){

            //console.log('no slide with that value: '+index)
            var new_slide = this._original_slides[index].clone()
            $(new_slide).attr("data-slide", index);
            this.addSlideListeners(new_slide);
            $(container).append(new_slide);
            
        },
        removeSlide:function(slide){
            this.removeSlideListeners(slide);
            $(slide).remove();
        },
        
        getRelativeIndexes:function(index, current_index, set_length){
            //return the distances of the item from the current index
            var dia = Math.abs(current_index - index)%set_length;
            var dib = Math.abs((current_index+set_length) - index)%set_length;
            var dic = Math.abs(current_index - (set_length+index))%set_length;


            var smallDistance = Math.abs(index-current_index)%set_length;
            var bigDistance = Math.abs(set_length - (index-current_index))%set_length;

            //console.log("Compare "+smallDistance+" "+bigDistance+" dia "+dia+" dib "+dib+" dic "+dic)

            var rightDistance = index >= current_index? dia : dic;
            var leftDistance = index >= current_index? dib : dib;
            return [rightDistance, leftDistance]
        },
        
        getIndexAfter:function(index){
            return (index+1)%this.set_length
        },
        getIndexBefore:function(index){
            return (index+this.set_length-1)%this.set_length
        }

    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function ( options ) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName,
                new RibbonCarousel( this, options ));
            }
        });
    };

})( jQuery, window, document );

