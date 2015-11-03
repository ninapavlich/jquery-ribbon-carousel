/*!
 * nina@ninalp.com
 */

;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "ribbonCarousel",
        defaults = {
            autoPlay:false,
            autoPlayInterval:8000,
            maxAutoPlayIntervals:1,
            useAnchors:false,
            pageAnchorPrefix:'slide-',
            animationDuration:600,
            animationEase:"easeInOutQuart",
            themeClass:'ribbon-carousel-theme-default',
            initialUnloadedClass:'unloaded',
            slideWidth:null,
            slideHeight:null,
            aspectRatio:1.8,
            minimumLoad:1,
            bufferSides:2,
            initKeyboardEvents:true,
            initDraggingEvents:true,
            initUI:true

        };

    // The actual plugin constructor
    function RibbonCarousel( element, options ) {
        this.element = element;

        $(this.element).data('ribbonCarousel', this);
        
        this.options = $.extend( {}, defaults, options) ;
        this.mobile_break = this.options.mobileBreak;
        this.average_aspect_ratio = null;

        this.calculateDimensions();
        
        
        this.all_images = [];
        this.all_images_index_hash = {};
        this.image_load_queue = [];
        this.loaded_images = [];
        this.loaded_images_index_hash = {};


        this.starting_loading_index = null;
        this.current_index = null;
        this.previous_rendered_index = null;

        this.initial_values_inited = false;
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
        this.is_autoplaying = false;

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
        this.was_autoplaying = false;
        this.drag_offset = 0;

        this.init();
    }


    RibbonCarousel.prototype = {

        init: function() {
            var parent = this;

            

            if(this.initial_values_inited==false){
                $(this.element).addClass('loading');
                $(this.element).removeClass(this.options.initialUnloadedClass);
                $(this.element).trigger('loading');
                $(this.element).addClass(this.options.themeClass);
                
                if(this.options.useAnchors==true){
                    this.current_index = this.starting_loading_index = this.getIndexFromHash(window.location.hash);
                }else{
                    this.current_index = this.starting_loading_index = 0;
                }
                this.initial_values_inited = true;
            }
            

            
            if(this.containers_inited==false){
                this.initContainers();
                this.resizeLoadingContainer();
                return;
            }


            if(this.event_listeners_inited==false){
                this.initDraggable();
                this.initUI();
                this.initGlobalListeners();
                this.init();
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
            $(this.original_slide_container).children("li").each(function(index, item){
                
                var img = $(item).find("img")[0];

                var slide = new SlideImage($(img).attr("src"), $(item).html(), index);                
                
                parent.all_images.push(slide);
                parent.all_images_index_hash[slide.index] = slide;

                $(img).removeAttr("src");

                $(slide).bind(SlideImage.EVENT_LOAD_COMPLETE, function(event){
                    parent.loaded_images.push(slide);
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
        initGlobalListeners:function(){

            if(this.event_listeners_inited==true){
                return;
            }

            var parent = this;

            if(this.options.initKeyboardEvents){
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
                parent.resizeLoadingContainer();

                if(parent.sufficiently_loaded==true){
                    parent.renderSlides();
                }
                
            })

            $(window).bind('hashchange', function(event) {
                var target_index = parent.getIndexFromHash(window.location.hash);
                if(parent.current_index != target_index){
                    parent.setSlideIndex(target_index, 'onHashChange');
                }
            });
            this.event_listeners_inited = true;            
        },
        loadNextSlide: function(){

            // console.log("Load "+this.loaded_images.length+" of "+this.all_images.length)
            
            if(this.image_load_queue.length > 0){
                var next_image = this.image_load_queue.shift();
                next_image.load();
            }else{
                $(this.element).addClass('loaded');
                $(this.element).removeClass('loading');
            }



            if(this.loaded_images.length >= this.options.minimumLoad){

                if(this.sufficiently_loaded==false){
                    this.resetAutoplay();
                    $(this.element).addClass('sufficiently-loaded');
                }
                this.sufficiently_loaded = true;
                this.init();
            }
        },
        setSlideIndex: function(requested_index, caller){
            if(this.rendering){
                this.request_next_index = requested_index;
                // console.log("Attempt to set index to "+requested_index+" from "+caller)
                return;
            }

            this.request_next_index = null;
            
            var attempted_index = this.sanitizeSlideIndex(requested_index);            
            
            
            if(this.current_index != attempted_index){
                this.current_index = attempted_index;
                // console.log("current_index = "+this.current_index+" caller: "+caller)
                $(this).trigger("SLIDE_CHANGE_EVENT");

                this.resetAutoplay();
            }
            
            if(this.options.useAnchors==true){
                window.location.hash = this.options.pageAnchorPrefix+(this.current_index+1);
            }

            this.renderSlides();
        },
        sanitizeSlideIndex: function(index){
            return (index + this.all_images.length) % this.all_images.length;
            
        },
        startAutoplay: function(){
            this.options.autoPlay = true;
            this.resetAutoplay();
            
        },
        resetAutoplay: function(){
            
            var parent = this;
            clearInterval(this.autoplay_interval);
            this.is_autoplaying = false;
            this.autoplay_count = 0;

            $(this.ui_container).find(".start").show();
            $(this.ui_container).find(".stop").hide();

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
                this.is_autoplaying = true;

                $(this.ui_container).find(".start").hide();
                $(this.ui_container).find(".stop").show();

            }else{
                $(this.ui_container).find(".start").show();
                $(this.ui_container).find(".stop").hide();
            }
            

        },
        stopAutoplay: function(){
            var parent = this;
            clearInterval(this.autoplay_interval);

            $(this.ui_container).find(".start").show();
            $(this.ui_container).find(".stop").hide();
            this.is_autoplaying = false;
        },
        goToNextSlide: function(){
            this.setSlideIndex(this.current_index + 1, "goToNextSlide");
        },
        goToPreviousSlide: function(){
            this.setSlideIndex(this.current_index - 1, "goToPreviousSlide");
        },
        getNextSlideIndex: function(){
            return this.sanitizeSlideIndex(this.current_index + 1);
        },
        getPreviousSlideIndex: function(){
            return this.sanitizeSlideIndex(this.current_index - 1);
        },
        resizeLoadingContainer: function(){
            if(this.sufficiently_loaded){
                $(this.element).css("min-height", 0);

            }else{
                $(this.element).css("min-height", this.slide_height);
                var ww = $(window).width();
                var dx = (ww - this.slide_width)/2;
                $(this.slide_container).css("width", $(window).width());
                $(this.slide_container).css("left", 0-dx);
            }
        },
        renderSlides: function(force){
            var parent = this;

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
            

            // console.log("renderSlides: "+this.previous_rendered_index+" to "+this.current_index)
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
            starting_left = starting_left - this.drag_offset;

            if(insertBefore){
                var target_left = 0-(this.options.bufferSides * this.slide_width);
            }else{
                var target_left = 0-(this.options.bufferSides * this.slide_width) - (this.slide_width * removeIndexes.length)
            }



            //Add new slides to beginning or end of container
            for(var k=0; k<addIndexes.length; k++){
                var slide = this.all_images_index_hash[addIndexes[k]];
                var slide_html = this.createSlide(slide);

                if(insertBefore){
                    $(this.slide_container).prepend(slide_html);    
                }else{
                    $(this.slide_container).append(slide_html);
                }

                
            }

            $(this.slide_container).css("left", starting_left);

            this.resizeContainers();

            //TODO -- resize slides:
            $(this.slide_container).children().css("width", this.slide_width);

            if(starting_left == target_left){
                parent.renderSlidesComplete();
            }else{

                $( this.slide_container ).animate({
                    left: target_left,
                }, this.options.animationDuration, this.options.animationEase, function() {
                    parent.renderSlidesComplete();
                });
            }

            

        },
        renderSlidesComplete: function(){
            var parent = this;
            var previousIndexQueue = this.getIndexQueue( this.previous_rendered_index );
            var indexQueue = this.getIndexQueue( this.current_index);

            //Remove old image containers
            var removeIndexes = this.getIndexesToRemove(previousIndexQueue, indexQueue);
            $(this.slide_container).children().each(function(index, item){
                var item_index = parseInt($(item).attr('data-index'));
                var remove_item = removeIndexes.indexOf(item_index)>=0;
                if(remove_item){
                    parent.destroySlide(item);                    
                }
            });


            var ending_target_left = 0-(this.options.bufferSides * this.slide_width);
            $(this.slide_container).css("left", ending_target_left);

            this.previous_rendered_index = this.current_index;
            this.drag_offset = 0;

            if(this.ui_inited==true){
                $(this.ui_container).find(".pagination a:not(:nth-child("+(this.current_index+1)+"))").removeClass("active");
                $(this.ui_container).find(".pagination a:nth-child("+(this.current_index+1)+")").addClass("active");

            }

            this.rendering = false;
            if(this.request_next_index!=null){
                this.setSlideIndex(this.request_next_index, "renderSlidesComplete - request_next_index");
            }else if(this.request_rerender==true){
                this.renderSlides(true);
            }
        },
        handleSlideClick: function(event, slide){
            if(this.is_dragging){
                return;
            }
            var slide_index = parseInt($(slide).attr('data-index'));
            if(this.current_index!=slide_index){
                event.preventDefault();
                this.setSlideIndex(slide_index, 'handleSlideClick');
            }

        },
        resizeContainers: function(){

            var parent = this;
        
            var slide_aspect_ratio = this.getAspectRatio();
            $(this.element).css("height", this.slide_height);
            $(this.slide_container).css("width", this.slide_width * this.all_images.length);
            
            //TODO -- improve logic here
            $(this.slide_container).children().each(function(index, item){
                
                $(item).css("width", parent.slide_width);
                $(item).css("height", parent.slide_height);

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
        createSlide: function(slide){
            var parent = this;
            var slide_element = $(slide.original_markup);

            $(slide_element).attr("data-index", slide.index);

            $(slide_element).bind("click", function(event){
                parent.handleSlideClick(event, this);
                
            })

            return slide_element;
        },

        destroySlide: function(item){
            $(item).remove();
            $(item).unbind("click");
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
        },
        initUI : function(){
            var parent = this;

            if(this.options.initUI==false){
                return;
            }
            if(this.ui_inited==true){
                return;
            }

            this.ui_container = $('<div class="ui"><div class="arrows"></div><div class="autoplay"></div><div class="pagination"></div></div>');
            this.ui_container.find(".arrows").html('<a href="#" class="next" title="Go to the next slide"><span>Next</span></a><a href="#" class="previous" title="Go to the previous slide"><span>Previous</span></a>');
            this.ui_container.find(".autoplay").html('<a href="#" class="start" title="Start Autoplay"><span>Start</span></a><a href="#" class="stop" title="Stop Autoplay"><span>Stop</span></a>');

            for(var k=0; k<this.all_images.length; k++){
                var link = $('<a href="#'+this.options.pageAnchorPrefix+(k+1)+'" data-index="'+(k+1)+'" title="Go to slide '+(k+1)+'"><span>Slide '+(k+1)+'</span></a>');
                
                $(this.ui_container).find(".pagination").append(link);               
            }

            $(this.ui_container).find(".next").bind("click", function(event){
                event.preventDefault();
                parent.goToNextSlide();
            });

            $(this.ui_container).find(".previous").bind("click", function(event){
                event.preventDefault();
                parent.goToPreviousSlide();
            });

            $(this.ui_container).find(".start").bind("click", function(event){
                event.preventDefault();
                parent.startAutoplay();
            });

            $(this.ui_container).find(".stop").bind("click", function(event){
                event.preventDefault();
                parent.stopAutoplay();
            });

            $(this.ui_container).find(".pagination a").bind("click", function(event){
                event.preventDefault();
                var index = parseInt($(this).attr("data-index"));
                parent.setSlideIndex(index-1);
            });

            $(this.element).append(this.ui_container);


            this.ui_inited = true;
        },        
        initDraggable : function(){
            if(this.options.initDraggingEvent==false){
                return;
            }
            if(this.draggable_inited==true){
                return;
            }
            
            try{
                $( this.slide_container).draggable( "destroy" );
            }catch(e){
                //
            }
            $( this.slide_container).draggable({
                snap: false,
                axis: 'x'
            });

            var parent = this;
            $( this.slide_container ).bind("dragstart", function(event, ui ){
                parent.onDragStart();
            });

            $( this.slide_container ).bind("drag", function(event, ui ){
                parent.onDrag();
            });

            $( this.slide_container ).bind("dragstop", function(event, ui ){
                parent.onDragStop();
            });
            this.draggable_inited = true;
        },
        onDragStart : function(){
            this.was_autoplaying = this.is_autoplaying;
            this.stopAutoplay();
            this.is_dragging = true;
            this.start_drag_position = parseInt($(this.slide_container).css("left"));
            this.drag_offset = 0;
            clearTimeout( this.drag_timeout )

        },
        onDrag : function(){            
            var left_pos = parseInt($(this.slide_container).css("left"))
            this.drag_offset = this.start_drag_position - left_pos;
            this.drag_direction = Math.abs(this.drag_offset) / this.drag_offset;
        },
        onDragStop : function(){
            
            var target_index = this.current_index;

            this.stop_drag_position = parseInt($(this.slide_container).css("left"));
            
            if(this.drag_direction > 0){
                target_index = this.getNextSlideIndex();
            }else{
                target_index = this.getPreviousSlideIndex();
            }
            this.setSlideIndex(target_index, 'onDragStop');

            // console.log("target_index = "+target_index+" was autoplaying? "+this.was_autoplaying)
            
            if(this.was_autoplaying){
                this.startAutoplay();
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

function SlideImage(src, original_markup, index) {

    this.has_image = typeof(src)!=='undefined';
    this.src = src;
    this.original_markup = original_markup;
    this.index = index;

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

    if(this.has_image){
        $(this.loader).attr("src", this.src);    
    }else{

        this.original_width = this.original_height = 100;
        this.original_aspect_ratio = 1;
        this.load_completed();
    }
    
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