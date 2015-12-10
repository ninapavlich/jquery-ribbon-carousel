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
        this.previous_rendered_queue = null;

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
                    parent.renderSlides(false, 0);
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

                this.pauseSlide(this.previous_rendered_index);
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
        renderSlides: function(force, duration){
            var parent = this;

            if(typeof(force)==undefined){
                force = false;
            }
            if(typeof(duration)==undefined){
                duration = this.options.animationDuration;
            }



            if(this.rendering){
                this.request_rerender = true;
                return;
            }

            var render_new_index = (this.previous_rendered_index != this.current_index) || force == true || this.buffer_sides_change!= 0;
            // console.log("render_new_index: "+render_new_index+" buffer_sides_change: "+this.buffer_sides_change)
            if(render_new_index){
                
                this.request_rerender = false;
                this.rendering = true;
                

                // console.log("renderSlides: "+this.previous_rendered_index+" to "+this.current_index)
                var previousIndexQueue = this.previous_rendered_queue == null? this.getIndexQueue( this.previous_rendered_index ) : this.previous_rendered_queue;
                var indexQueue = this.getIndexQueue( this.current_index);
                var dx = this.previous_rendered_index - this.current_index;
                
                

                var insertBefore = this.isBefore(this.current_index, this.previous_rendered_index);
                var flipped = this.isFlipped(insertBefore, dx);
                var same = indexQueue.equals(previousIndexQueue);
                // console.log("Queue for "+this.current_index+" is "+indexQueue+" (previous was "+previousIndexQueue+") ");//dx:"+dx+" insertBefore: "+insertBefore+" flipped: "+flipped+" same?? "+same)
                var addSlideIndexes = same? [] : this.getSlideIndexesToAdd(previousIndexQueue, indexQueue, dx, flipped);
                var removeIndexes = same? [] : this.getIndexesToRemove(previousIndexQueue, indexQueue, dx, flipped, insertBefore);
                

                // console.log("addSlideIndexes: "+addSlideIndexes+" removeIndexes: "+removeIndexes+" insertBefore: "+insertBefore)
                if(insertBefore){
                    addSlideIndexes.reverse();
                }
                
                


                //Add new slides to beginning or end of container
                var added_buffer = this.buffer_sides_change < 0;
                if(added_buffer){
                    
                    //insert before
                    for(var k=(addSlideIndexes.length/2)-1; k>=0; k--){
                        var slide_index = addSlideIndexes[k];
                        // console.log('insert before '+k+" = "+slide_index)
                        var slide = this.all_images_index_hash[slide_index];
                        var slide_html = this.createSlide(slide);
                        $(this.slide_container).prepend(slide_html);    
                    }

                    //insert after
                    for(var k=addSlideIndexes.length/2; k<addSlideIndexes.length; k++){
                        var slide_index = addSlideIndexes[k];
                        // console.log('insert after '+k+" = "+slide_index)
                        var slide = this.all_images_index_hash[slide_index];
                        var slide_html = this.createSlide(slide);
                        $(this.slide_container).append(slide_html);    
                    }


                }else{
                    for(var k=0; k<addSlideIndexes.length; k++){
                        var slide_index = addSlideIndexes[k];
                        var slide = this.all_images_index_hash[slide_index];
                        var slide_html = this.createSlide(slide);

                        // console.log("insert at "+k+" which is "+slide_index+" "+slide_html)
                        if(insertBefore){
                            $(this.slide_container).prepend(slide_html);    
                        }else{
                            $(this.slide_container).append(slide_html);
                        }
                    }
                }

                //Apply active classes:
                var next_index = this.getNextSlideIndex();
                var previous_index = this.getPreviousSlideIndex();

                $(this.slide_container).children().each(function(index, item){
                    var slide_index = parseInt($(item).attr('data-index'));

                    $(item).removeClass("current");
                    $(item).removeClass("next");
                    $(item).removeClass("previous");
                    if(slide_index == parent.current_index){
                        $(item).addClass("current");
                    }else if(slide_index == next_index){
                        $(item).addClass("next");
                    }else if(slide_index == previous_index){
                        $(item).addClass("previous");
                    }

                    

                });

            
            }else{
                var insertBefore = false;
                var removeIndexes = [];
            }

            //calculate new x positions for animation
            if(insertBefore){
                var starting_left = 0 - (this.buffer_sides * this.slide_width) - (this.slide_width * removeIndexes.length)
            }else{
                var starting_left = 0 - (this.buffer_sides * this.slide_width) //- (slide_width * addSlideIndexes.length);
            }
            starting_left = starting_left - this.drag_offset;

            if(insertBefore){
                var target_left = 0-(this.buffer_sides * this.slide_width);
            }else{
                var target_left = 0-(this.buffer_sides * this.slide_width) - (this.slide_width * removeIndexes.length)
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
                }, duration, this.options.animationEase, function() {
                    parent.renderSlidesComplete();
                });
            }

            

        },
        renderSlidesComplete: function(){
            var parent = this;
            var previousIndexQueue = this.getIndexQueue( this.previous_rendered_index );
            var indexQueue = this.getIndexQueue( this.current_index);
            var insertBefore = this.isBefore(this.current_index, this.previous_rendered_index);
            var dx = this.previous_rendered_index - this.current_index;
            var flipped = this.isFlipped(insertBefore, dx);
            var use_dx = dx;//flipped? dx < 0? -1 : dx  : dx < 0? dx : 0;

            var currentActualQueue = [];
            $(this.slide_container).children().each(function(index, item){
                var item_index = parseInt($(item).attr('data-index'));
                currentActualQueue.push(item_index);
            });
            // console.log("Actual queue is "+currentActualQueue+" shooting for "+indexQueue+"")

            //Remove old image containers
            var removeIndexes = this.getIndexesToRemove(currentActualQueue, indexQueue, use_dx, flipped, insertBefore);
            // console.log("slide container now has "+$(this.slide_container).children().length+" children, need to remove indexes at "+removeIndexes+" dx: "+dx+" use_dx: "+use_dx)
            
            

            $(this.slide_container).children().each(function(index, item){
                var slide_index = parseInt($(item).attr('data-index'));
                var remove_item = removeIndexes.indexOf(index)>=0;
                if(remove_item){
                    parent.destroySlide(item);                    
                }
            });

            var afterQueue = [];
            $(this.slide_container).children().each(function(index, item){
                var item_index = parseInt($(item).attr('data-index'));
                afterQueue.push(item_index);
            });
            this.previous_rendered_queue = afterQueue;
            // console.log("--> AFTER queue is "+afterQueue)


            var ending_target_left = 0-(this.buffer_sides * this.slide_width);
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
            console.log("slide index clicked: "+slide_index)
            if(this.current_index!=slide_index){
                event.preventDefault();
                this.setSlideIndex(slide_index, 'handleSlideClick');
            }

        },
        resizeContainers: function(){

            var parent = this;
        
            var slide_aspect_ratio = this.getAspectRatio();
            $(this.element).css("height", this.slide_height);
            var total_slides = $(this.slide_container).children().length;
            $(this.slide_container).css("width", this.slide_width * total_slides);
            
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
            }else if(dist > half_length){
                dist = this.current_index - (this.previous_rendered_index+l);
            }
            
            if(dist<0){
                return true;
            }else{
                return false;
            }
        },
        isFlipped: function(before, dx){
            
            if(dx==0){
                return false;
            }
            if(before==false && dx < 0){
                return false;
            } else if(before==true && dx >= 0){
                return false;
            }else{
                return true;
            }
        },
        
        getIndexesToRemove: function(previous_queue, current_queue, dx, flipped, insertBefore){
            var changelist = [];


            if(current_queue.equals(previous_queue)){
                return []
            }

            var lx = current_queue.length - previous_queue.length;
            // console.log("LX: "+lx)
            
            // if(flipped){
            //     var flipped_dx = dx - this.all_images.length;
            //     console.log("dx = "+dx+" flipped_dx: "+flipped_dx)
            //     if(flipped_dx < 0){
            //         //remove the first X from the beginning
            //         changelist = previous_queue.slice(0, 0-flipped_dx);
            //     }else if(flipped_dx > 0){
            //         //remove the last X from the end
            //         changelist = previous_queue.slice(0-flipped_dx);
            //     }
            // }else{
            //     if(dx < 0){
            //         //remove the first X from the beginning
            //         changelist = previous_queue.slice(0, 0-dx);

            //     }else if(dx > 0){
            //         //remove the last X from the end
            //         changelist = previous_queue.slice(0-dx);
            //     }
            // }
            // console.log("REMOVE SUBSET: "+changelist)


            for(var k=0; k<previous_queue.length; k++){
                var index = current_queue[k];
                var item = previous_queue[k];


                var new_index;
                if(flipped){
                    var flipped_dx = dx < 0? dx + this.all_images.length: dx - this.all_images.length;
                    // console.log("dx: "+dx+" flipped_dx: "+flipped_dx)
                    if(flipped_dx < 0){
                        new_index = k + flipped_dx;
                    }else{
                        new_index = k + flipped_dx + lx;
                    }
                }else{
                    if(dx < 0){
                        new_index = k + dx;
                    }else if(dx > 0) {
                        new_index = k + dx + lx;
                    }else{
                        if(lx > 0 && this.buffer_sides_change < 0){
                            //added a buffer
                            new_index = k + lx/2;
                            // console.log("added a buffer, nex index is "+k+" to "+new_index)
                            
                        }else if(lx < 0 && this.buffer_sides_change > 0){
                            //removed a buffer
                            new_index = k + lx/2;
                            // console.log("removed a buffer, nex index is "+k+" to "+new_index)

                        }else if(lx > 0){
                            new_index = k;        
                        }
                    }
                }


                 // = flipped? insertBefore? k + dx: k - dx : insertBefore? k - dx + 1: k + dx;
                // flipped? dx < 0? k - dx - 1 : dx <= 1? k - dx : k - dx + 1: k + dx;
                var new_item = new_index >=0 && new_index < current_queue.length? current_queue[new_index] : null; 
                // console.log("REMOVE: Does the old item "+item+" that was at index "+k+" exist in the new queue at index "+new_index+"? "+(item == new_item)+" insertBefore? "+insertBefore)
                
                if(item !== new_item){
                    changelist.push(k);
                }
                // var index = current_queue[k];
                // if(current_queue.indexOf(index)<0){
                //     changelist.push(index);
                // }
            }
            // console.log("REMOVE SUBSET: "+changelist)
            return changelist;
        },
        


        getSlideIndexesToAdd: function(previous_queue, current_queue, dx, flipped){
            
            
            var changelist = [];
            if(current_queue.equals(previous_queue)){
                return []
            }

            var lx = current_queue.length - previous_queue.length;
            
            if(flipped){
                var flipped_dx = dx < 0? dx + this.all_images.length: dx - this.all_images.length;
                if(flipped_dx < 0){
                    //add last X to the end
                    changelist = current_queue.slice(flipped_dx-lx);
                }else{
                    //add first X to the beginning
                    changelist = current_queue.slice(0, flipped_dx+lx); //lx for the beginning
                }
            }else{
                if(dx < 0){
                    //add last X to the end
                    changelist = current_queue.slice(dx-lx);
                }else if (dx > 0){
                    //add first X to the beginning
                    changelist = current_queue.slice(0, dx+lx); //lx for the beginning
                }else{
                    if(lx > 0 && this.buffer_sides_change < 0){
                        // console.log("we added a buffer!")
                        //add first X to the beginning
                        changelist = current_queue.slice(0, lx/2).concat( current_queue.slice( 0 - (lx/2) ) )  
                        
                    }else if(lx < 0 && this.buffer_sides_change > 0){
                        // console.log("we removed a buffer!")
                        changelist = [];

                    }else if(lx > 0){
                        //add first X to the beginning
                        changelist = current_queue.slice(0, lx); //lx for the beginning        
                    }
                    

                }
            }
            // console.log("ADD SUBSET: "+changelist)
            // for(var k=0; k<current_queue.length; k++){
            //     var index = current_queue[k];
            //     var new_item = current_queue[k];
            //     var previous_index = k-dx//flipped? (dx < 0? k + dx + 1 : dx <= 1? k + dx : k + dx - 1)  : k - dx;
            //     //hack:
            //     //Need to refactor....
            //     // dx < 0 k + dx + 1
            //     // dx = 1,0 k + dx
            //     // dx > 1 k + dx - 1
            //     // k - dx

            //     var previous_item = previous_index >=0 && previous_index < previous_queue.length? previous_queue[previous_index] : null; 
            //     console.log("ADD: Does the new item "+new_item+" that is at index "+k+" exist in the old queue at index "+previous_index+"? "+(previous_item == new_item))
                
            //     if(previous_item !== new_item){
            //         changelist.push(index);
            //     }

            //     // var index = current_queue[k];
            //     // if(previous_queue.indexOf(index)<0){
            //     //     changelist.push(index);
            //     // }
            // }
            // return changelist;
            return changelist;
        },
        getIndexQueue: function(current_index){
            var indexQueue = [];

            if(current_index==null){
                return [];
            }

            var first_index = current_index;
            var l = this.all_images.length;

            for(var k=this.buffer_sides-1; k>=0; k--){
                var last_index = this.sanitizeSlideIndex( ((l-1-k) + first_index) % l );
                indexQueue.push(last_index);
                // console.log("k: "+k+" last: "+last_index)
            }

            indexQueue.push(first_index%l);

            for(var k=0; k<this.buffer_sides; k++){
                var next_index = this.sanitizeSlideIndex( (first_index + k + 1) % l );
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
        pauseSlide: function(pause_index){
            
            var slide_item = null;
            $(this.slide_container).children().each(function(index, item){
                var slide_index = parseInt($(item).attr('data-index'));
                if(slide_index == pause_index){
                    slide_item = item;
                }
            });

            
            //Pause any iframe activity:
            if($(slide_item).find("iframe").length > 0){
                $(slide_item).find("iframe").each(function(iframe_index, iframe_item){
                    var iframe_source = $(iframe_item).attr('src');
                    $(iframe_item).attr('src', ""); // sets the source to nothing, stopping the video
                    $(iframe_item).attr('src', iframe_source);
                });
            }
                        
                    
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
        getBufferSides: function(){
            return Math.ceil($(window).width() / this.slide_width);
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

            
            var bs = this.getBufferSides();;
            this.buffer_sides_change = this.buffer_sides - bs;
            this.buffer_sides = bs
            // console.log("buffer = "+this.buffer_sides+" buffer_sides_change: "+this.buffer_sides_change)
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
            var drag_magnitude = Math.ceil(Math.abs(this.start_drag_position - this.stop_drag_position) / this.slide_width);
            
            if(this.drag_direction > 0){
                target_index = this.sanitizeSlideIndex(this.current_index + drag_magnitude);
            }else{
                target_index = this.sanitizeSlideIndex(this.current_index - drag_magnitude);
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

/* Array Equality Shim */

// Warn if overriding existing method
if(Array.prototype.equals)
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});