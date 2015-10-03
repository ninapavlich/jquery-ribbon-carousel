/*!
 * nina@ninalp.com
 * TODO:
 * - UI Controls
 */

;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "ribbonCarousel",
        defaults = {
            autoPlay:false,
            autoPlayInterval:10000,
            animationDuration:500,
            maxAutoPlayIntervals:1,
            useAnchors:true,
            pageAnchorPrefix:'slide-',
            themeClass:'ribbon-carousel-theme-default',
            slideWidth:null,
            slideHeight:null,
            aspectRatio:1.8,
            minimumLoad:1,
            bufferSides:2,
            useKeyboardEvents:true
        };

    // The actual plugin constructor
    function RibbonCarousel( element, options ) {
        this.element = element;

        $(this.element).data('ribbonCarousel', this);
        window['carousel'] = this;

        this.options = $.extend( {}, defaults, options) ;
        this.mobile_break = this.options.mobileBreak;
        this.average_aspect_ratio = null;

        this.calculateDimensions();

        
        
        this.all_images = [];
        this.all_images_src_hash = {};
        this.all_images_index_hash = {};
        this.image_load_queue = [];
        this.loaded_images = [];
        this.loaded_images_src_hash = {};
        this.loaded_images_index_hash = {};


        this.starting_loading_index = null;
        this.current_index = null;
        this.previous_rendered_index = null;


        this.containers_inited = false;
        this.event_listeners_inited = false;
        this.sufficiently_loaded = false;

        this.rendering = false;
        this.request_next_index = null;
        this.request_rerender = false;

        this.original_slide_container = null;
        this.slide_container = null;

        this.autoplay_interval = null;
        this.autoplay_count = 0;

        this.init();
    }


    RibbonCarousel.prototype = {

        init: function() {
            
            $(this.element).addClass('loading');
            $(this.element).trigger('loading');
            $(this.element).addClass(this.options.themeClass);



            if(this.options.useAnchors==true){
                this.current_index = this.starting_loading_index = this.getIndexFromHash(window.location.hash);
            }else{
                this.current_index = this.starting_loading_index = 0;
            }

            var parent = this;
            
            if(this.containers_inited==false){
                this.initContainers();
                return;
            }


            if(this.event_listeners_inited==false){
                this.initListeners();
                return;
            }
            


            if(this.sufficiently_loaded==false){
                this.loadNextSlide();
                return;

            }

            this.renderSlides();
            

        },
        initContainers: function(){
            var parent = this;

            if(this.containers_inited == true){
                return;
            }

            //Gather image sources and stop loading:
            this.original_slide_container = $(this.element).find("ul")[0];
            $( this.original_slide_container).remove();
            $(this.original_slide_container).find("img").each(function(index, item){
                
                var slide = new SlideImage($(this).attr("src"), $(this).attr("alt"), index);                
                $(this).removeAttr("src");

                parent.all_images.push(slide);
                parent.all_images_src_hash[slide.src] = slide;
                parent.all_images_index_hash[slide.index] = slide;


                $(slide).bind(SlideImage.EVENT_LOAD_COMPLETE, function(event){
                    parent.loaded_images.push(slide);
                    parent.loaded_images_src_hash[slide.src] = slide;
                    parent.loaded_images_index_hash[slide.index] = slide;

                    parent.average_aspect_ratio = parent.calculateAverageAspectRatio();

                    parent.loadNextSlide();
                });
                $(slide).bind(SlideImage.EVENT_LOAD_ERROR, function(event){
                    // console.log("ERROR Loading image: "+slide.src)
                    parent.loadNextSlide();
                });
            });


          

            //Create a loading queue that toggles between first and last items.
            this.image_load_queue = [];
            var l = this.all_images.length;
            var is_even = ( l%2 ) == 0;
            var max = Math.ceil(l/2);
            var indexes = [];
            for(var k=0; k<max; k++){
                var first_index = (k + this.starting_loading_index) % l;

                indexes.push(first_index);
                this.image_load_queue.push(this.all_images_index_hash[first_index]);
                
                var next_index = ((l - (k+1)) + this.starting_loading_index) % l;
                if(first_index!=next_index){
                    this.image_load_queue.push(this.all_images_index_hash[next_index]);
                    indexes.push(next_index);
                }
            }  
            
            this.slide_container = $("<div class='slide-container-inner' />");
            $(this.element).append(this.slide_container)

            this.containers_inited = true;
            this.init();
        },
        initListeners:function(){
            var parent = this;

            if(this.options.useKeyboardEvents){
                $( document ).bind("keydown", function(event) {
                    if (event.keyCode == '37') {
                        // left arrow
                        parent.goToPreviousSlide();
                    }else if (event.keyCode == '39') {
                        // right arrow
                        parent.goToNextSlide();
                    }
                });
            }
            

            $(window).bind("resize", function(event){
                parent.calculateDimensions();
                parent.renderSlides();
            })

            $(window).bind('hashchange', function(event) {
                var target_index = parent.getIndexFromHash(window.location.hash);
                if(parent.current_index != target_index){
                    parent.setSlideIndex(target_index);
                }
            });
            this.event_listeners_inited = true;
            this.init();
        },
        loadNextSlide: function(){

            // console.log("Load "+this.loaded_images.length+" of "+this.all_images.length)
            
            if(this.image_load_queue.length > 0){
                var next_image = this.image_load_queue.shift();
                next_image.load();
            }else{
                $(this.element).removeClass('loading');
            }



            if(this.loaded_images.length >= this.options.minimumLoad){

                if(this.sufficiently_loaded==false){
                    this.resetAutoplay();
                }
                this.sufficiently_loaded = true;
                this.init();
            }
        },
        setSlideIndex: function(requested_index){
            if(this.rendering){
                this.request_next_index = requested_index;
                return;
            }

            this.request_next_index = null;
            
            var attempted_index = requested_index;            
            attempted_index = (requested_index + this.all_images.length) % this.all_images.length;
            
            if(this.current_index != attempted_index){
                this.current_index = attempted_index;
                // console.log("current_index = "+this.current_index)
                $(this).trigger("SLIDE_CHANGE_EVENT");

                this.resetAutoplay();
            }
            
            if(this.options.useAnchors==true){
                window.location.hash = this.options.pageAnchorPrefix+(this.current_index+1);
            }

            this.renderSlides();
        },

        startAutoplay: function(){
            this.options.autoPlay = true;
            this.resetAutoplay();
            
        },
        resetAutoplay: function(){
            
            var parent = this;
            clearInterval(this.autoplay_interval);
            this.autoplay_count = 0;

            if(this.options.autoPlay){
                this.autoplay_interval = setInterval(function(){
                    
                    parent.autoplay_count += 1;
                    var max = (parent.all_images.length * parent.options.maxAutoPlayIntervals);
                
                    if( max == 0 || max >= parent.autoplay_count ){
                        parent.goToNextSlide();    
                    }else{
                        parent.stopAutoplay();
                    }
                    
                }, this.options.autoPlayInterval)

            }
            

        },
        stopAutoplay: function(){
            var parent = this;
            clearInterval(this.autoplay_interval);
        },
        goToNextSlide: function(){
            this.setSlideIndex(this.current_index + 1);
        },
        goToPreviousSlide: function(){
            this.setSlideIndex(this.current_index - 1);
        },
        renderSlides: function(force){
            if(typeof(force)==undefined){
                force = false;
            }

            if(this.rendering){

                this.request_rerender = true;

                return;
            }

            if(this.previous_rendered_index == this.current_index && force==false){
              
                this.resizeContainers();
                return;
            }
            
            this.request_rerender = false;
            this.rendering = true;
            var parent = this;

            // console.log("render slides: "+this.previous_rendered_index+" to "+this.current_index)
            var previousIndexQueue = this.getIndexQueue( this.previous_rendered_index );
            var indexQueue = this.getIndexQueue( this.current_index);
            
            var addIndexes = this.getIndexesToAdd(previousIndexQueue, indexQueue);
            var removeIndexes = this.getIndexesToRemove(previousIndexQueue, indexQueue);
            var insertBefore = this.isBefore(this.current_index, this.previous_rendered_index);

            // console.log("addIndexes: "+addIndexes+" removeIndexes: "+removeIndexes+" insertBefore: "+insertBefore)
            if(insertBefore){
                addIndexes.reverse();
            }
            
            //calculate new x positions for animation
            if(insertBefore){
                var starting_left = 0 - (this.options.bufferSides * this.slide_width) - (this.slide_width * removeIndexes.length)
            }else{
                var starting_left = 0 - (this.options.bufferSides * this.slide_width) //- (slide_width * addIndexes.length);
            }

            if(insertBefore){
                var target_left = 0-(this.options.bufferSides * this.slide_width);
            }else{
                var target_left = 0-(this.options.bufferSides * this.slide_width) - (this.slide_width * removeIndexes.length)
            }



            //Add new slides to beginning or end of container
            for(var k=0; k<addIndexes.length; k++){
                var slide = this.all_images_index_hash[addIndexes[k]];
                var slide_html = this.renderSlideHTML(slide);

                if(insertBefore){
                    $(this.slide_container).prepend(slide_html);    
                }else{
                    $(this.slide_container).append(slide_html);
                }
            }

            $(this.slide_container).css("left", starting_left);

            this.resizeContainers();

            //TODO -- resize slides:
            $(this.slide_container).find("figure").css("width", this.slide_width);

            if(starting_left == target_left){
                parent.renderSlidesComplete();
            }else{

                $( this.slide_container ).animate({
                    left: target_left,
                }, this.options.animationDuration, function() {
                    parent.renderSlidesComplete();
                });
            }

            

        },
        renderSlidesComplete: function(){

            var previousIndexQueue = this.getIndexQueue( this.previous_rendered_index );
            var indexQueue = this.getIndexQueue( this.current_index);

            //Remove old image containers
            var removeIndexes = this.getIndexesToRemove(previousIndexQueue, indexQueue);
            $(this.slide_container).find("figure").each(function(index, item){
                var figure_index = parseInt($(item).attr('data-index'));
                var remove_figure = removeIndexes.indexOf(figure_index)>=0;
                if(remove_figure){
                    $(item).remove();
                }
            });


            var ending_target_left = 0-(this.options.bufferSides * this.slide_width);
            $(this.slide_container).css("left", ending_target_left);

            this.previous_rendered_index = this.current_index;

            this.rendering = false;
            if(this.request_next_index!=null){
                this.setSlideIndex(this.request_next_index);
            }else if(this.request_rerender==true){
                this.renderSlides(true);
            }
        },
        resizeContainers: function(){

            var parent = this;
        
            var slide_aspect_ratio = this.getAspectRatio();
            $(this.element).css("height", this.slide_height);
            $(this.slide_container).css("width", this.slide_width * this.all_images.length);
            

            //TODO -- improve logic here
            $(this.slide_container).find("figure").each(function(index, item){
                $(item).css("width", this.slide_width);
                $(item).css("height", this.slide_height);

                var figure_index = parseInt($(item).attr('data-index'));
                var slide = parent.all_images_index_hash[figure_index]
                
                // $(item).attr("original-aspect-ratio", slide.original_aspect_ratio);

                if(slide.original_aspect_ratio > slide_aspect_ratio){
                    //image is wider, so we'll need to set the height of the image to fill the slide
                    $(item).find("img").css("height", parent.slide_height+'px');
                    $(item).find("img").css("width", "auto");
                    $(item).find("img").attr("data-size", "wider");
                    var sw = slide.original_aspect_ratio * parent.slide_height;
                    var dx = -0.5 * (sw-parent.slide_width);
                    $(item).find("img").css("left", dx+"px");
                    
                }else{
                    //image is taller, so we'll need to set the width to fill the slide

                    $(item).find("img").css("height", "auto");
                    $(item).find("img").css("width", parent.slide_width+'px');
                    $(item).find("img").attr("data-size", "taller");

                    var sh = parent.slide_width / slide.original_aspect_ratio;
                    var dy = -0.5 * (sh-parent.slide_height);
                    $(item).find("img").css("top", dy+"px");
                    
                }

                
            });
        },
        isBefore: function(new_index, current_index){
            var l = this.all_images.length;
            var half_length = Math.ceil(l/2);

            var dist = this.current_index - this.previous_rendered_index;
            if( dist <= 0-half_length){
                dist = (this.current_index+l) - this.previous_rendered_index;
            }else if(dist >= half_length){
                dist = this.current_index - (this.previous_rendered_index+l);
            }
            
            if(dist<0){
                return true;
            }else{
                return false;
            }
        },
        getIndexesToRemove: function(previous_queue, current_queue){
            var changelist = [];
            for(var k=0; k<previous_queue.length; k++){
                var index = previous_queue[k];
                if(current_queue.indexOf(index)<0){
                    changelist.push(index);
                }
            }
            return changelist;
        },
        getIndexesToAdd: function(previous_queue, current_queue){
            var changelist = [];
            for(var k=0; k<current_queue.length; k++){
                var index = current_queue[k];
                if(previous_queue.indexOf(index)<0){
                    changelist.push(index);
                }
            }
            return changelist;
        },
        getIndexQueue: function(current_index){
            var indexQueue = [];

            if(current_index==null){
                return [];
            }

            var first_index = current_index;
            var l = this.all_images.length;

            for(var k=this.options.bufferSides-1; k>=0; k--){
                var last_index = ((l-1-k) + first_index) % l;
                indexQueue.push(last_index);
                // console.log("k: "+k+" last: "+last_index)
            }

            indexQueue.push(first_index%l);

            for(var k=0; k<this.options.bufferSides; k++){
                var next_index = (first_index + k + 1) % l;
                indexQueue.push(next_index);
            }

            return indexQueue;
        },
        renderSlideHTML: function(slide){
            return '<figure data-index="'+slide.index+'"><img src="'+slide.src+'" alt="'+slide.alt+'" /><figcaption>'+slide.alt+'</figcaption></figure>';
        },
        getSlideIfAvailable: function(index){
            if(index in this.loaded_images_index_hash){
                return this.loaded_images_index_hash[index];
            }else{
                //if first is not available, get first available
                return this.loaded_images[0];
            }
        },
        getAspectRatio: function(){
            if(this.aspect_ratio){
                return this.aspect_ratio;
            }else{
                return this.average_aspect_ratio;
            }
        },
        calculateDimensions: function(){
            if(this.options.slideWidth && this.options.slideHeight){
                this.slide_width = this.options.slideWidth;
                this.slide_height = this.options.slideHeight;
                this.aspect_ratio = this.options.slideWidth / this.options.slideHeight;
                // console.log("Determine aspect ratio from width and height")
            }else if(this.options.slideWidth && this.options.aspectRatio){
                this.slide_width = this.options.slideWidth;
                this.aspect_ratio = this.options.aspectRatio;
                this.slide_height = this.options.slideWidth / this.options.aspectRatio;
                // console.log("Determine slide height from width and aspect ratio")
            }else if(this.options.slideHeight && this.options.aspectRatio){
                this.aspect_ratio = this.options.aspectRatio;
                this.slide_height = this.options.slideHeight;
                this.options.slideWidth = this.options.slideHeight * this.options.aspectRatio;
                // console.log("Determine slide width from height and aspect ratio")
            }else if(this.options.aspectRatio){
                this.slide_width = $(this.element).parent().width();
                this.aspect_ratio = this.options.aspectRatio;
                this.slide_height = this.slide_width / this.aspect_ratio;
                
                // console.log("Determine slide width and height from aspect ratio and container width")
            }else{
                // console.log("WARNING: Neither slide width, slide height or aspect ratio are defined. Two of these should be defined.")
            }
            // console.log("Size: "+this.slide_width+" x "+this.slide_height+" ratio: "+this.aspect_ratio)
        },
        calculateAverageAspectRatio:function(){

            var total = 0;
            var l = this.loaded_images.length;
            for(var k=0; k<l; k++){
                var slide = this.loaded_images[k];
                total += slide.original_aspect_ratio;
            };

            return total / l;
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

function SlideImage(src, alt, index) {

  this.src = src;
  this.alt = alt;
  this.index = index;
  // console.log("PRE LOADED: "+index+" - "+src)

  this.loaded = false;
  this.loading = false;
  this.loading_error = false;
  this.load_requested = false;

  this.original_width = null;
  this.original_height = null;
  this.original_aspect_ratio = null;

  this.loader = $("<img />");

  var parent = this;
  $(this.loader).bind("load", function(event){
    parent.original_width = this.width;
    parent.original_height = this.height;
    parent.original_aspect_ratio = this.width / this.height;
    // console.log('LOADED: '+parent.index+" : "+parent.original_width+" x "+parent.original_height+" = "+parent.original_aspect_ratio+" "+parent.src)
    parent.load_completed();
  });
  $(this.loader).bind("error", function(event){
    parent.load_error();
  });

}

SlideImage.EVENT_LOAD_STARTED = 'EVENT_LOAD_STARTED';
SlideImage.EVENT_LOAD_COMPLETE = 'EVENT_LOAD_COMPLETE';
SlideImage.EVENT_LOAD_ERROR = 'EVENT_LOAD_ERROR';

SlideImage.prototype.load = function () {
    this.loading = true;
    this.load_requested = true;
    $(this).trigger(SlideImage.EVENT_LOAD_STARTED);
    $(this.loader).attr("src", this.src);
    // console.log("loading "+this.src)
    // console.log("LOAD: "+this.index)
};
SlideImage.prototype.load_completed = function () {
    this.loading = false;
    this.loaded = true;

    $(this).trigger(SlideImage.EVENT_LOAD_COMPLETE);
    // console.log("complete!")
};
SlideImage.prototype.load_error = function () {
    this.loading = false;
    this.loading_error = true;
    $(this).trigger(SlideImage.EVENT_LOAD_ERROR);
};