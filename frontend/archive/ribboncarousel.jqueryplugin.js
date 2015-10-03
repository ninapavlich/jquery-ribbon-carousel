/*!
 * nina@ninalp.com
 */


;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "ribbonCarousel",
        defaults = {
            mobileBreak:767,
            autoPlay:false,
            autoPlayInterval:5000,
            maxAutoPlayIntervals:0,
            containerWidthPortion:1,
            useAnchors:false,
            pageAnchorPrefix:'slide',
            themeClass:'ribbon-carousel-theme-default',
            aspectRatio:null

        };

    // The actual plugin constructor
    function RibbonCarousel( element, options ) {
        this.element = element;

        this.options = $.extend( {}, defaults, options) ;

        this.containers_inited = false;
        this.slides_inited = false;
        this.ready = false;

        this.mobile_break = this.options.mobileBreak;
        this._defaults = defaults;
        this._name = pluginName;
        this._original_slides = [];
        this.attempted_index = 0;
        this.current_index = 0;
        this.previous_index = 0;
        this.previous_rendered_index = -1;
        this.previous_rendered_platform = null;
        this.dot_index = 0;
        this.min_index = 0;
        this.max_index = null;
        this.set_length = null;
        this.can_animate = true;
        this.loadedFromBeginning = false;


        this.draggable_inited = false;
        this.is_dragging = false;
        this.drag_direction = 0;
        this.start_drag_position = null;
        this.start_drag_position_left = null;
        this.start_drag_position_right = null;
        this.stop_drag_position = null;
        this.stop_drag_position_left = null;
        this.stop_drag_position_right = null;
        this.drag_timeout = null;


        this.is_playing = false;
        this.autoprogress_timeout = -1;
        this.current_autoplay_interval = 0;

        this.average_aspect_ratio = 1.6; //default
        this.aspect_ratio = this.average_aspect_ratio;

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

            // console.log("this.slides_inited: "+this.slides_inited+" ready? "+this.ready)
            
            $(this.element).addClass('loading');
            $(this.element).trigger('loading');
            $(this.element).addClass(this.options.themeClass);


            if(this.options.useAnchors==true){
                this.starting_loading_index = this.getIndexFromHash(window.location.hash);
            }else{
                this.starting_loading_index = 0;
            }

            var parent = this;
            
            if(this.containers_inited==false){
                this.containers_inited = true;
                this.createContainers();
            }
            

            if(this.ready==false){ 
                if(this._original_slides.length >= 1){
                    this.ready = true;
                }
            }

            if(this.slides_inited == false){
                this.slides_inited = true;
                this.startSlideQueue();
            }


            if(this.ready==false){
                return;
            }

            // console.log("ready, but still show loading")
            //return;
            $(this.element).addClass('ready');
            $(this.element).trigger('ready');

            $(this.element).removeClass('loading');


            if(this.options.autoPlay==true){
                this.setIsPlaying(true);
            }else{
                this.setIsPlaying(false);
            }   

            this.attempted_index = this.current_index = this.starting_loading_index;

            // this.measureContents();
            this.resizeImages();
            this.addListeners();
            //this.removeListeners()

            this.setIndex(this.current_index); 
            

        },
        createContainers: function(){
            this.original_slide_container = $(this.element).find("ul")[0];

            //Create containers
            $('<div class="controls"><div class="container"></div></div>').insertBefore(this.original_slide_container);
            this.controls_container = $(this.element).find(".controls > .container");
            $('<div class="slides"><div class="container"></div></div>').insertBefore(this.original_slide_container);
            this.slides_container = $(this.element).find(".slides > .container");


            //Clone original slides and hide
            $(this.original_slide_container).css("display", "none");


            //populate controls container
            var arrows="<ul class='carousel-arrows'><li><a href='#' class='next'><span>Next</span></a></li><li><a href='#' class='previous'><span>Previous</span></a></li></ul>";
            var playpause="<ul class='carousel-play-pause'><li><a href='#play' class='play'><span>Play</span></a></li><li><a href='#pause' class='pause'><span>Pause</span></a></li></ul>";
            var pagination = "<ul class='carousel-pagination'></ul>";
            $(this.controls_container).append($(pagination+arrows+playpause));
            

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
        },
        startSlideQueue: function(){


            var slides = $(this.original_slide_container).find("li");
            var totalLoadedSlides = this._original_slides.length;
            var totalSlides = $(slides).length;

            // console.log("totalLoadedSlides: "+totalLoadedSlides+" of "+totalSlides)
            if(totalSlides == totalLoadedSlides){
                $(this.element).trigger('done-loading');
                this.addPaginationListeners();                
            }else{
                var nextSlideIndex = this.getNextSlideLoadIndex();
                var nextSlide = slides[nextSlideIndex];
                this.addSlide(nextSlide, nextSlideIndex);
            }

            this.initDraggable();

            
        },
        getNextSlideLoadIndex: function(){
            
            //Instead of loading in order, switch between loading first and last items
            //0, last, 1, last-1, 2, last-2
            var slides = $(this.original_slide_container).find("li");
            var totalSlides = $(slides).length;
            var totalLoadedSlides = this._original_slides.length;

            if(this.loadedFromBeginning==true){
                var nextSlideIndex = totalSlides - ((totalLoadedSlides+1)/2)
            }else{
                var nextSlideIndex = totalLoadedSlides/2;
            }
            // console.log("nextSlideIndex: "+nextSlideIndex)
            this.loadedFromBeginning = !this.loadedFromBeginning;
            
            var adjustedSlideIndex = (this.starting_loading_index+nextSlideIndex) % totalSlides;

            // console.log("nextSlideIndex: "+nextSlideIndex+" adjustedSlideIndex: "+adjustedSlideIndex)
            return adjustedSlideIndex
        },
        addSlide: function (slide, index){
            // console.log("Add slide at "+index)
            index = ('undefined' === typeof index)? this._original_slides.length : index;
            this.loadSlide(slide, index, this.slideLoaded)
        },
        loadSlide: function(slide, index, callback) {
            
            var parent = this;
            var image = $(slide).find("img")[0];
            var isMeasured = parent.isImageMeasured(image);
            if(isMeasured==false){

                var url = parent.getImageSrc(image);
                $(image).attr("src", url);
                $("<img/>").attr("src", url).load(function() {
                    $(image).data('inited', true);
                    $(image).attr('data-inited', true);
                    
                    var aspect_ratio = this.width / this.height;
                    
                    $(image).data('image-aspect-ratio', aspect_ratio);
                    $(image).attr('data-image-aspect-ratio', aspect_ratio);

                    $(slide).data('index', index);
                    $(slide).attr('data-index', index);
                    
                    callback.call(parent, slide, index)
                });
            }
        },
        getImageSrc:function(image){
            if(this.isMobile()){
                return $(image).attr("data-mobile");
            }else{
                return $(image).attr("data-desktop");
            }
        },
        slideLoaded:function(slide, index){
            var cloned = $(slide).clone();
            this._original_slides.push(cloned);

            this._original_slides.sort(function(a, b) {
                var a_index = parseInt($(a).attr('data-index'));
                var b_index = parseInt($(b).attr('data-index'));
                if(a_index < b_index){
                    return -1;
                }else if(a_index > b_index){
                    return 1;
                }else{
                    return 0;
                }
            });
            
            //Add pagination item...
            var pagination_item = "<li><a href='#'><span>Slide "+(index+1)+"</span></a></li>";
            $(this.controls_container).find(".carousel-pagination").append(pagination_item);


            this.set_length = this._original_slides.length;
            this.max_index = this.set_length - 1;

            this.average_aspect_ratio = this.calculateAverageAspectRatio();
            this.aspect_ratio = this.options.aspectRatio==null? this.average_aspect_ratio : this.options.aspectRatio;

            if(this.ready==false){
                this.init();        
            }else{
                this.setIndex(this.attempted_index, true); 
            }


            this.startSlideQueue();
            
                
        },
        setIndex: function(target_index, force) {
            if ('undefined' === typeof force) {
                force = false;
            }

            //console.log("Set index: "+target_index+" this.can_animate: "+this.can_animate+" force: "+force)
            if(this.can_animate == false && force == false){
                this.next_index = target_index;

                //block click, currently animating
                return;
            }

            this.previous_index = this.current_index;
            this.attempted_index = target_index;
            this.current_index = Math.max(Math.min(this.max_index, target_index), this.min_index)
            
            //console.log("the target index is "+target_index);
            //console.log("the current index is "+this.current_index);
            //console.log("the max index is "+this.max_index);
            
            $(this.element).trigger('index_change', [this.current_index]);

            this.render(force);
            
            this.setIsPlaying(this.is_playing);            
            
        },
        getNextSlideIndex: function(){
            return (this.current_index + 1) % this.set_length;
        },
        getPreviousSlideIndex: function(){
            return (this.current_index + this.set_length - 1) % this.set_length;
        },
        setIsPlaying:function(val){
            var parent = this;

            // console.log("set is_playing = "+val)
            if(this.is_playing != val){
                $(this.element).trigger('is_playing', [val]);

                //reset current autoplay interval
                this.current_autoplay_interval = 0;
            }
            this.is_playing = val;

            if(this.is_playing){
                $(this.element).find(".controls a.pause").css("display", "block");    
                $(this.element).find(".controls a.play").css("display", "none");    
            }else{
                $(this.element).find(".controls a.pause").css("display", "none");
                $(this.element).find(".controls a.play").css("display", "block");
            }




            
            if(this.is_playing && this.set_length > 1){
                
                clearTimeout(this.autoprogress_timeout);

                var canAutoPlay = this.options.maxAutoPlayIntervals <= 0 || (this.set_length * this.options.maxAutoPlayIntervals) > this.current_autoplay_interval
                
                if( canAutoPlay ){
                    this.autoprogress_timeout = setTimeout(function(){
                        parent.current_autoplay_interval += 1;
                
                        if(parent.is_playing){
                            var next_index = parent.getIndexAfter(parent.current_index);

                            if(parent.options.useAnchors==true){
                                document.location.hash = parent.options.pageAnchorPrefix+(next_index+1);                        
                            }else{
                                parent.setIndex(next_index);
                            }
                        }
                    }, this.options.autoPlayInterval); 
                }
            }else if(this.is_playing==false){
                clearTimeout(this.autoprogress_timeout);
            }
        },
        getIndexFromHash:function(hash){
            if ('undefined' === typeof hash) {
                hash = document.location.hash;
            }

            if(hash==''){
                return 0;
            }
            
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
        getImageListContainer:function(){
            if($(this.element).prop("tagName") == 'UL'){
                return this.element;
            }else if($(this.element).find('ul').length > 0){
                return $(this.element).find('ul')[0];
            }else{
                return this.element;
            }
        },
        render: function(force) {
            if ('undefined' === typeof force) {
                force = false;
            }
            var parent = this; 


            //Handle logic for Animating Center Item
            var columnWidth = this.getImageColumnWidth();
            var containerWidth = this.getContainerWidth();

            // console.log("columnWidth: "+columnWidth+" containerWidth: "+containerWidth)
            var targetAnimationDuration = force? 0 : 400;
            var minTargetAnimationDuration = force? 0 : 200;

            

            var center_indexes = this.getCenterIndexes(this.current_index, this.set_length);

            var distances = this.getRelativeIndexes(this.current_index, this.previous_index, this.set_length);
            var rightDistance = distances[0];
            var leftDistance = distances[1];
            var moving_right = rightDistance < leftDistance;
            var moving_distance = moving_right? rightDistance : leftDistance;
                        

            var center_index = Math.floor(center_indexes.length/2);
            var target_offset = 0-(columnWidth*center_index);
            var starting_offset = this.stop_drag_position!=null? moving_right? (this.stop_drag_position+columnWidth) : (this.stop_drag_position-columnWidth) : moving_right? (target_offset + (moving_distance*columnWidth)) : (target_offset - (moving_distance*columnWidth));


            var target_offset_right = target_offset - columnWidth;
            var starting_offset_right = starting_offset - columnWidth;

            var target_offset_left = target_offset;// + columnWidth;
            var starting_offset_left = target_offset;//+ columnWidth;
            var isMobile = this.isMobile()
            var platform = isMobile? 'mobile' : 'desktop';

            var is_new_index = this.previous_rendered_index != this.current_index;
            var is_new_set = this.previous_rendered_set_length != this.set_length;
            var is_new_platform = this.previous_rendered_platform != platform;
            var is_new_render = is_new_index || is_new_set || is_new_platform;

            // console.log("is_new_index: "+is_new_index+" is_new_render: "+is_new_render)
            // console.log("indexes for "+this.current_index+" are "+center_indexes)
            // console.log("is_new_platform: "+is_new_platform)
            
            if(is_new_render){
                this.previous_rendered_set_length = this.set_length;
                this.previous_rendered_platform = platform;
                this.setImages(center_indexes, this.carousel_center, false);

                if(this.isMobile()){
                    this.setImages([], this.carousel_right, false);
                    this.setImages([], this.carousel_left, false);
                }else{
                    this.setImages(center_indexes, this.carousel_right, false);
                    this.setImages(center_indexes, this.carousel_left, false);
                }
                

                this.can_animate = false;

                var distanceToTravel = Math.abs(starting_offset-target_offset);
                var distancePortion = Math.min(1, distanceToTravel/columnWidth);

                var animationDuration = targetAnimationDuration;//minTargetAnimationDuration + (distancePortion * (targetAnimationDuration-minTargetAnimationDuration));
                
                $( this.carousel_center ).css("left", starting_offset+"px");
                $( this.carousel_center ).animate({ left:target_offset }, animationDuration);


                $( this.carousel_right ).css("left", starting_offset_right+"px");
                $( this.carousel_right ).animate({ left:target_offset_right }, animationDuration);

                $( this.carousel_left ).css("left", starting_offset+"px");
                $( this.carousel_left ).animate({ left:target_offset }, animationDuration);


                this.can_animate = false;
                setTimeout(function(){
                    parent.can_animate = true
                }, animationDuration+100)


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
            this.stop_drag_position = null;

        },
        isImageMeasured: function(image) {

            if( $(image).data('inited') && $(image).data('inited') == true){
                //ugbire
                return true;

            }else{
                
                if( typeof($(image).data('image-aspect-ratio')) !== 'undefined' && 
                    typeof($(image).data('image-aspect-ratio')) !== 'undefined'){
                    //woooohaa, it's already inited!
                    $(image).data('inited', true);
                    
                    return true

                }else{

                    return false;

                }

            }

        },
        

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

            // console.log("LEFT? "+left+" center_right? "+center_right+" columnWidth? "+columnWidth)

            $(this.carousel_left).css("width", left);
            $(this.carousel_right).css("width", center_right);
            $(this.carousel_right_container).css("width", center_right);
            $(this.carousel_center).css("width", center_right);
        },
        resizeImages:function(){
            //for each image, scale to fill its container
            var columnWidth = this.getImageColumnWidth();

            var columnHeight = Math.round(columnWidth / this.aspect_ratio);
            var halfHeight = Math.round(columnHeight*0.5);

            // console.log("columnWidth: "+columnWidth+" columnHeight: "+columnHeight+" aspectRatio: "+this.aspect_ratio)
            
            $(this.element).css("height", columnHeight);

            $(this.element).find(".carousel-arrows").css("top", halfHeight);
            $(this.element).find(".carousel-pagination").css("top", columnHeight);
            $(this.element).find(".carousel-play-pause").css("top", columnHeight);
            
            
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

                var url = parent.getImageSrc(img);
                $(img).attr("src", url);

                var original_aspect_ratio = $(img).data("image-aspect-ratio");
                var container_width = $(this).outerWidth();
                var container_height = $(this).outerHeight();

                // console.log("container_width: "+container_width+" container_height: "+container_height+" original_aspect_ratio: "+original_aspect_ratio)

                // if(parent.options.imageFill){
                    parent.imageFill(img, container_width, container_height, original_aspect_ratio);    
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
        imageFill:function(img, container_width, container_height, original_aspect_ratio){


            var container_aspect_ratio = container_width / container_height;

            
           
            if(original_aspect_ratio > container_aspect_ratio){
                //image is wider than container... scale to height and chop sides


                $(img).css("width", "auto");
                $(img).css("height", container_height+"px");
                var image_width = original_aspect_ratio * container_height;
                var dx = -0.5 * (image_width - container_width);


                $(img).css("margin-left", dx+"px");
                $(img).css("margin-top", "0px");


            }else{
                //image is taller than container ... scale to width and chop top and bottom

                $(img).css("height", "auto");
                $(img).css("width", container_width+"px");
                var image_height = container_width / original_aspect_ratio;


                var dy = -0.5 * (image_height - container_height);

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

            if(this.set_length<2){
                $(this.controls_container).parent().addClass("disabled")
            }else{
                $(this.controls_container).parent().removeClass("disabled")
            }
            

            //set next and previous 
            var next_index = this.getNextSlideIndex();
            var prev_index = this.getPreviousSlideIndex();

            

            var new_next_url = "#"+this.options.pageAnchorPrefix+(next_index+1);
            var new_prev_url = "#"+this.options.pageAnchorPrefix+(prev_index+1);

            $(this.carousel_arrows).find(".next").attr('href', new_next_url);
            $(this.carousel_arrows).find(".previous").attr('href', new_prev_url);

            
            var parent = this;
            $(this.controls_container).find(".carousel-pagination li").each(function(index, item) {
                var paginationHref = "#"+parent.options.pageAnchorPrefix+(index+1);
                $(item).find('a').attr('href', paginationHref);
            });
            
            

        },
        addListeners: function() {
            //bind click events on the arrows and dots
            var parent = this
            

            $(this.element).find(".controls a").bind("click", function(e) {
                parent.controlLinkClicked(e, this);
            });


            $(window).bind("resize", function(event){
                // parent.measureContents();
                parent.resizeImages();
                parent.resizeContainers();
                parent.alignContainers();  
                parent.render();              
            });

            $(window).bind('hashchange', function(event) {
                //detect url from 
                var newIndex = parent.getIndexFromHash();
                parent.setIndex(newIndex);

            });

            
        },
        addPaginationListeners: function(){
            var parent = this;
            $(this.controls_container).find(".carousel-pagination").find("a").bind("click", function(e) {
                parent.controlLinkClicked(e, this);
            });
        },
        controlLinkClicked:function(e, target){
            switch (e.which) {
                case 1:

                    var href = $(target).attr('href');
                    if(href.indexOf(this.options.pageAnchorPrefix)>=0){
                        if(this.options.useAnchors==false){
                            e.preventDefault();
                            e.defaultPrevented;                    
                            var new_index = this.getIndexFromHash(href);
                            this.setIndex(new_index);    
                        }                            
                    }else if(href=="#play"){
                        e.preventDefault();
                        e.defaultPrevented; 
                        this.setIsPlaying(true);

                    }else if(href=="#pause"){
                        e.preventDefault();
                        e.defaultPrevented; 
                        this.setIsPlaying(false);
                    }
                    
                    break;
            } 

        },
        addSlideListeners:function(slide){
            //add 
            var parent = this;
            var target_index = $(slide).attr('data-slide');
            $(slide).bind("click", function(e) {
                
                //if slide isn't currently featured, bring to center.     
                if(target_index != parent.current_index){
                    e.preventDefault();
                    e.defaultPrevented; 
                    parent.setIndex(target_index);
                }                
            });
            $(slide).find("a").bind("click", function(e) {
                
                //if slide isn't currently featured, bring to center.     
                if(target_index != parent.current_index){
                    e.preventDefault();
                    e.defaultPrevented; 
                    parent.setIndex(target_index);
                }                
            });
        },
        removeListeners: function() {
            //unbind click events on the arrows and dots
            $(this.element).find(".controls a").unbind("click");
        },
        removeSlideListeners:function(slide){
            //remove 
            $(slide).find("a").unbind("click");
            $(slide).unbind("click");
        },
        getImageColumnWidth:function(){
            var ww = $(window).width();
            if(ww <= this.mobile_break){
                return ww;
            }
            var w = $(this.slides_container).outerWidth();
            return w * this.options.containerWidthPortion;
        },
        calculateAverageAspectRatio:function(){

            var parent = this;
            var set = $(this.element).find("ul.carousel-center > li"); 
            var total = 0;
            $(set).each(function(index, item){
                var img = $(this).find("img");
                var original_aspect_ratio = parseFloat($(img).data("image-aspect-ratio"));
                total += original_aspect_ratio;
            });

            return total / set.length;
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
        },
        isMobile:function(){
            var columnWidth = this.getImageColumnWidth();
            return columnWidth <= this.mobile_break
        },
        initDraggable : function(){
            if(this.draggable_inited==true){
                return;
            }
            
            this.carousel_center
            try{
                $( this.carousel_center).draggable( "destroy" );
            }catch(e){
                //
            }
            $( this.carousel_center).draggable({
                snap: false,
                axis: 'x'
            });

            var parent = this;
            $( this.carousel_center ).bind("dragstart", function(event, ui ){
                parent.onDragStart();
            });

            $( this.carousel_center ).bind("drag", function(event, ui ){
                parent.onDrag();
            });

            $( this.carousel_center ).bind("dragstop", function(event, ui ){
                parent.onDragStop();
            });
            this.draggable_inited = true;
        },
        onDragStart : function(){
            //update container:
            //console.log("drag start! container? "+this.slides_container+" "+$(this.slides_container).css("left"))
            
            this.is_dragging = true;
            this.start_drag_position = parseInt($(this.carousel_center).css("left"));
            this.start_drag_position_left = parseInt($(this.carousel_left).css("left"));
            this.start_drag_position_right = parseInt($(this.carousel_right).css("left"));
            
            clearTimeout( this.drag_timeout )

        },
        onDrag : function(){

            
            var left_pos = parseInt($(this.carousel_center).css("left"))
            var drag_offset = this.start_drag_position - left_pos;
            // console.log("drag! this.start_drag_position? "+this.start_drag_position+" left_pos? "+left_pos)
            this.drag_direction = Math.abs(drag_offset) / drag_offset;

            $(this.carousel_left).css("left", this.start_drag_position_left - drag_offset)
            $(this.carousel_right).css("left", this.start_drag_position_right - drag_offset)
            
        },
        onDragStop : function(){
            
            var target_index = this.current_index;

            this.stop_drag_position = parseInt($(this.carousel_center).css("left"));
            this.stop_drag_position_left = parseInt($(this.carousel_left).css("left"));
            this.stop_drag_position_right = parseInt($(this.carousel_right).css("left"));
            
            if(this.drag_direction > 0){
                target_index = this.getNextSlideIndex();
            }else{
                target_index = this.getPreviousSlideIndex();
            }
            if(this.options.useAnchors==true){
                document.location.hash = this.options.pageAnchorPrefix+(target_index+1);                        
            }else{
                this.setIndex(target_index);
            }
            


            var parent = this;
            this.drag_timeout = setTimeout(function(){
                parent.is_dragging = false;
            },100)

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

