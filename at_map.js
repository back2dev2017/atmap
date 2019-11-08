function initialsetup() {
  // kick off async loading the county data, but since it is a promise, this keeps going in parallel
  loadstatecounties();
  // note: this may be a good place to kick off loading children info, but for now, because doing test data
  // using random numbers, this had to be placed in the load of the counties
  // loadchilddata();

  // set up general global variables used for any drawing, color, etc
  dataobj.boxwidth =  $('#mapcontainer').width();
  dataobj.boxheight = dataobj.boxwidth * (6/9);
  dataobj.dataviewtype = 'remaining'; // 'base' shows number of signed up and number served, 'remaining' is other view
  dataobj.viewlevel = 'nation'; // view nation at start, set to state name when viewing state
  dataobj.kidstotal = 0; // total number of kids signed up
  dataobj.kidsmatched = 0; // total number of kids assigned/matched - note: remaining is simple math after this
  // do some visual clean-up and preparation
  $('#mapnote').width(dataobj.boxwidth - 20);
  $('#scale').css({display: 'flex'});
  // put a listener over the map controls to remove any pop-up labels
  let sidediv = document.getElementById('mapcontrols')
  sidediv.addEventListener('mouseover', function() {$('#labeltip').css({display:'none'});}, false);
};

function loadnationstates() {
  // purpose: load in the json data to draw the national level. Put that data into a 'global' object so that
  // it is easily accessible. Important Note: the base json data will be converted to topojson format - this
  // drastically reduces size, an improves drawing performance
  let jsondatafile = './topojson/us-albers-1.json';
  d3.json(jsondatafile).then(function(data) {
    // assign the data pulled in to a global object - do not have to load again
    dataobj.countrydata = data;
    dataobj.drawcountry = topojson.feature(data, data.objects.us); // for us-albers-1 (subobjs)
    // draw the nation - state level
    drawnation();
    // the source .json file has state name info, etc, we can use that to set up other page objects
    setupstatepicker(dataobj.drawcountry);
  });
}

function setupstatepicker (mycountrydata) {
  // the passed data is specifically USA json topojson data, so can pull states from that. Then the
  // global 'statelist' array will hold all the state names. Once we have that, we can build a
  // dropdown selection of states.
  mycountrydata.features.forEach(function(item) {
    dataobj.statelist.push(item.properties.name);
  });
  // want the states to be sorted, so had to create that array first, now we'll sort and add
  dataobj.statelist.sort();
  let statedropdown = document.getElementById('statepicker');
  let tmpselitem = document.createElement('option');
  // make a special first selection, it shows a 'starting point' and reminds to select something
  tmpselitem.text = '-Select a State-';
  tmpselitem.value = '--';
  statedropdown.add(tmpselitem);
  dataobj.statelist.forEach(function(item) {
    tmpselitem = document.createElement('option');
    tmpselitem.text = item;
    tmpselitem.value = item;
    statedropdown.add(tmpselitem);
  });
};

function setupcountypick(pstatename) {
  // purpose is to set up a dropdown list containing the list of counties of a selected state. Note 
  // there are lots of special things to consider - like detecting when a state was changed and
  // thus need to rebuild the county list. This function simply recreates the list for the passed
  // state. So code that calls this function needs to do it appropriately.
  //   One check we will do here is see if the passed state is the state we already are viewing. If
  // it is, we do not want to regen (because that would reset the county selection to the first item). 
  // the 'dataobj.viewlevel' holds the state name if previously viewing by state.
  if (pstatename != dataobj.viewlevel) {
    dataobj.countylist = [];
    // recall that json data may not have been sorted by state order - so need to check them all
    dataobj.countyinfo.forEach(function(item) {
      if (item.state == pstatename) {
        dataobj.countylist.push(item.county);
      };
    });
    
    dataobj.countylist.sort(); // we want counties sorted alphabetically
  
    // empty out the county dropdown - in case it was previously picked
    $('#countypicker').empty(); // jQuery empty() is nice and quick
    $('#countydetails').text(''); // remove text that displayed counts
    let pickertemp = document.getElementById('countypicker');
    let tmpitem = document.createElement('option');
    // make a special first selection, it shows a 'starting point' and reminds to select something
    tmpitem.text = '-Select a County-';
    tmpitem.value = '--';
    pickertemp.add(tmpitem);
    dataobj.countylist.forEach(function(item) {
      tmpitem = document.createElement('option');
      tmpitem.text = item;
      tmpitem.value = item;
      pickertemp.add(tmpitem);
    });
  };
};

function loadstatecounties() {
  // this function loads geojson data for all state counties
  jsondatafile = './topojson/us-albers-counties.json';
  d3.json(jsondatafile).then(function(data) {
    dataobj.statedata = data;
    dataobj.drawstate = topojson.feature(data, data.objects.collection);
    //   temporary call here - using the above to get the list of all counties - this will be removed when
    // direct access to real data is obtained - or modify loadchilddata() to pull from source
    loadchilddata();
    //   note this odd order of loading - need child data for county/state numbers - and thus fill color so
    // do not want to draw nation until we had that - ref color 'range' function. So this probably looks
    // weird to be loading nation data from inside county loading - but this is all because of the async
    // performance of 'promises' - and note the d3.json() function is a promise - which means other code
    // can run in parallel while d3.json() is loading. If we put code in the '.then()' block, we can be
    // assured of the sequence and we know the data has finished loading.
    loadnationstates();
  });
}

function mystateclick(stateitem) {
  // console.log(stateitem.properties.name);
  let statedropdown = document.getElementById('statepicker');
  for (let i=0; i<statedropdown.options.length;i++) {
    if (statedropdown[i].value == stateitem.properties.name) {
      statedropdown.options[i].selected = true;
      break;
    };
  };
  drawonestate(stateitem.properties.name);
  setupcountypick(stateitem.properties.name);
  $('countyselection').css({display: 'flex'});
};

function mystatehover (d) {
  let mydiv = document.getElementById('mapnote');
  // mydiv.style.display = 'block';
  // mydiv.innerText = d.properties.name + ' (Total need: ' + dataobj.stateinfo[d.properties.name].need.toLocaleString('en') + ')';
  $('#labeltip').css({display: 'flex', height:'50px'});

  // set the info for the 'hovered' state
  $('#labeltip').css({left: event.pageX + 2 + 'px', top: event.pageY + 2 + 'px'});
  $('#mainline').text(d.properties.name);
  let [theneed, theassigned, theremaining] = [dataobj.stateinfo[d.properties.name].need.toLocaleString('en'), 
                                              dataobj.stateinfo[d.properties.name].assigned.toLocaleString('en'), 
                                              dataobj.stateinfo[d.properties.name].remaining.toLocaleString('en')]; 
  $('#subline').html('Signed up: ' + theneed + '<br>Assigned: ' + theassigned);
};

function mycountyhover (d) {
  // recall that the pop-up label should have been hidden at the national level - display it now
  $('#labeltip').css({display: 'flex', height:'20px'});
  // set the info for the 'hovered' county
  $('#labeltip').css({left: event.pageX + 2 + 'px', top: event.pageY + 2 + 'px'});
  $('#mainline').text(d.properties.name + ' County');
  $('#subline').text('');
  // let [theneed, theassigned, theremaining] = (typeof(d.need) == "undefined" ? [0, 0, 0]: [d.need, d.assigned, d.assigned - d.need]);
  // $('#subline').text('Signed up: ' + theneed + ', Served: ' + theassigned);
  // $('#subline').text('Remaining need: ' + theremaining);
}

function mycountyclick(d) {
  // console.log(d);
  let dropdown = document.getElementById('countypicker');
  for (let i=0; i<dropdown.options.length;i++) {
    if (dropdown[i].value == d.properties.name) {
      dropdown.options[i].selected = true;
      break;
    };
  };
  showcountyinfo(d.properties.name)
};


function drawnation() {
  // assumes data has been loaded and set up in dataobj.drawcountry. This function will create the
  // svg DOM element, and draw within it. 
  dataobj.svg = null;
  // hide any state pop-up labels, and hide Return to National div
  $('#labeltip').css({display: 'none'});
  $('#back2nation').css({display: 'none'});
  $('#countyselection').css({display: 'none'});
 
  let projection = d3.geoMercator();
  let map = void 0;
  let country = void 0;
  let path = d3.geoPath().projection(projection);

  if ($('#svgarea')) {
    $('#svgarea').remove();
  };
  dataobj.svg = d3.select('#map')
    .append('svg')
    .attr('id', 'svgarea')
    .attr('width', dataobj.boxwidth)
    .attr('height', dataobj.boxheight);

  // this is the main 'drawing' functionality
  let b, s, t;
  projection.scale(1).translate([0,0]);
  // get the max bounds of all the values - creates array bottom/left, top/right
  b = path.bounds(dataobj.drawcountry);
  s = .9 / (Math.max((b[1][0] - b[0][0]) / dataobj.boxwidth, (b[1][1] - b[0][1]) / dataobj.boxheight));
  t = [(dataobj.boxwidth - s * (b[1][0] + b[0][0])) / 2, (dataobj.boxheight - s * (b[1][1] + b[0][1])) / 2];
  projection.scale(s).translate(t);

  map = dataobj.svg.append('g').attr('class', 'boundary');
  // country = map.selectAll('path').data(subobjs.features);
  country = map.selectAll('path').data(dataobj.drawcountry.features);

  country.enter()
    .append('path')
    .attr('d', path)
    .attr('fill', function(d,i) {
      // create heat map based on either viewing served or remaining
      let dispval = 0;
      //   so, we will detect which display to use - focus on served or remaining counts. We will set up the
      // color scale based on .dataviewtype, and then use the data value based on .dataviewtype. Note that
      // all this just pertains to the 'fill' color of the item being drawn.
      if (dataobj.dataviewtype == 'remaining') {
        dataobj.mapcolors = d3.scaleLinear().domain([0,dataobj.statemaxremaining]).range(['#ffffff','#ff4466']);
        dispval = dataobj.stateinfo[d.properties.name].remaining;
      } else {
        dataobj.mapcolors = d3.scaleLinear().domain([0,(dataobj.statemaxneed - dataobj.statemaxremaining)]).range(['#ffffff','#ff4466']);
        dispval = dataobj.stateinfo[d.properties.name].assigned;
      }
      return dataobj.mapcolors(dispval);})
    .on('mouseover', mystatehover)
    .on('click', mystateclick);

  country.exit().remove();

  dataobj.viewlevel = 'nation'; // set flag to denote viewing national
  infoblockupdate(); // to update the info block with national info
};

function drawonestate(statename) {
  // if the '--' selection was picked from the state dropdown, draw the nation
  if (statename.includes('--')) {
    drawnation();
  } else {
    let state2pull = statename;
    // recall the structure of the data required for d3 to use: an object with a 'type' and an array.
    let tempstate = {};
    let tmpitem = {};
    let totstateneed = 0;
    mydata = dataobj.drawstate.features.filter(function(item) {
      let tmpitem = item;
      if (item.properties.state == state2pull) {
        // console.log(item.properties.state, item.properties.name);
        for (let i=1; i<dataobj.countyinfo.length; i++) {
          if ((dataobj.countyinfo[i].county == item.properties.name) && (dataobj.countyinfo[i].state == item.properties.state)) {
            // if I found the right state and county, return an object with need, assigned, remaining properties
            if (typeof(dataobj.countyinfo[i].assigned) == "undefined") {
              // better to not display 'undefined' to the user
              tmpitem['need'] = 0;
              tmpitem['assigned'] = 0;
              tmpitem['remaining'] = 0;
              break;
            } else {
              tmpitem['need'] = dataobj.countyinfo[i].need;
              tmpitem['assigned'] = dataobj.countyinfo[i].assigned;
              tmpitem['remaining'] = dataobj.countyinfo[i].remaining;
              break;
            };
          };
        };
        return tmpitem;
      };
    });
    tempstate.type = 'FeatureCollection';
    tempstate.features = mydata;
    
    dataobj.tmpmaxneed = dataobj.tmpmaxremaining = dataobj.tmpmaxassigned = 0;
    mydata.forEach(function(item) {
      dataobj.tmpmaxneed = Math.max(dataobj.tmpmaxneed, item.need);
      dataobj.tmpmaxremaining = Math.max(dataobj.tmpmaxremaining, item.remaining);
      dataobj.tmpmaxassigned = Math.max(dataobj.tmpmaxassigned, item.assigned);
    });
    
        // set up the scale for colors, consider type of view
    if (dataobj.dataviewtype == 'remaining') {
      dataobj.statecolors = d3.scaleLinear().domain([0,dataobj.tmpmaxremaining]).range(['#ffffff','#ff4466']);
    } else {
      dataobj.statecolors = d3.scaleLinear().domain([0,dataobj.tmpmaxassigned]).range(['#ffffff','#ff4466']);
    };

    let projection = d3.geoMercator();
    let map = void 0;
    let drawitem = void 0;
    let path = d3.geoPath().projection(projection);
    
    // this is the main 'drawing' functionality
    let b, s, t;
    projection.scale(1).translate([0,0]);
    // get the max bounds of all the values - creates array bottom/left, top/right
    b = path.bounds(tempstate);
    s = .9 / (Math.max((b[1][0] - b[0][0]) / dataobj.boxwidth, (b[1][1] - b[0][1]) / dataobj.boxheight));
    t = [(dataobj.boxwidth - s * (b[1][0] + b[0][0])) / 2, (dataobj.boxheight - s * (b[1][1] + b[0][1])) / 2];
    projection.scale(s).translate(t);
    
    $('#svgarea').remove();
    dataobj.svg = null;
    dataobj.svg = d3.select('#map')
      .append('svg')
      .attr('id', 'svgarea')
      .attr('width', dataobj.boxwidth)
      .attr('height', dataobj.boxheight);

    map = dataobj.svg.append('g').attr('class', 'boundary');
    // country = map.selectAll('path').data(subobjs.features);
    drawitem = map.selectAll('path').data(tempstate.features);
    
    drawitem.enter()
      .append('path')
      .attr('d', path)
      .attr('fill', function(d,i) {
        let val2use = (dataobj.dataviewtype == 'remaining' ? d.remaining : d.assigned);
        return dataobj.statecolors(val2use);
      })
      .on('mouseover', mycountyhover)
      .on('click', mycountyclick);


      // look at the following code to figure out mouseover to play with highlighting objects, etc

      // look at http://bl.ocks.org/michellechandra/0b2ce4923dc9b5809922

      //   .on("mouseover", function(d) {      
      //     div.transition()        
      //          .duration(200)      
      //          .style("opacity", .9);      
      //          div.text(d.place)
      //          .style("left", (d3.event.pageX) + "px")     
      //          .style("top", (d3.event.pageY - 28) + "px");    
      // })   
    
      //   // fade out tooltip on mouse out               
      //   .on("mouseout", function(d) {       
      //       div.transition()        
      //          .duration(500)      
      //          .style("opacity", 0);   
      //   });


    drawitem.exit().remove();
    
    // show the "National View" div, clear any pop-up (may have been hovering over a different state)
    $('#back2nation').css({display: 'block'});
    $('#labeltip').css({display: 'none'});
    $('#countyselection').css({display: 'flex'});
    // any time a state is redrawn, the available counties need to be redone
    setupcountypick(statename); // call this before setting .viewlevel, can then check if state has changed
    dataobj.viewlevel = statename; // set flag to denote which state being viewed
    infoblockupdate(); // to update the infoblock with state level data
  };
};

function loadchilddata () {
  // since I do not have a file yet, this code will do some random number generation
  dataobj.stateinfo = {};
  dataobj.countyinfo = [];
  //   loop through and set up the stateinfo object - this is because county data may not be sorted by 
  // state - so summing is difficult
  dataobj.statedata.objects.collection.geometries.forEach(function(item) {
    dataobj.stateinfo[item.properties.state] = {};
    dataobj.stateinfo[item.properties.state].need = 0;
    dataobj.stateinfo[item.properties.state].assigned = 0;
    dataobj.stateinfo[item.properties.state].remaining = 0;
    dataobj.stateinfo[item.properties.state].assignedpct = 0;
  });

  let cntyassigned = cntyneed = 0;
  dataobj.statedata.objects.collection.geometries.forEach(function(item) {
    // randomize a need, then randomize assigned (always <= need)
    cntyneed = Math.round(Math.random() * 180);
    cntyassigned = Math.max(Math.round((Math.random() * cntyneed)-40), 0);
    // add the info to the countinfo array - an object {state, county, need, assigned}
    let tmpobj = {'county':item.properties.name, 
                  'state':item.properties.state, 
                  'assigned':cntyassigned, 
                  'need':cntyneed, 
                  'remaining':cntyneed-cntyassigned,
                  'assignedpct': cntyneed == 0 ? 0 : Math.round((cntyassigned/cntyneed) * 100)
                };
    dataobj.countyinfo.push(tmpobj);
    // add info to the state summing - note the "+=" syntax - calculating on the fly so do not have to loop through again later
    dataobj.stateinfo[item.properties.state].need += cntyneed;
    dataobj.stateinfo[item.properties.state].assigned += cntyassigned;
    dataobj.stateinfo[item.properties.state].remaining += (cntyneed - cntyassigned);
    dataobj.kidstotal += cntyneed;
    dataobj.kidsmatched += cntyassigned;
  });

  // now that we have the numbers and counts, we will set up the national level 'color scale'
  dataobj.statemaxneed = dataobj.statemaxremaining = 0;
  for (let key of Object.keys(dataobj.stateinfo)) {
    dataobj.statemaxneed = Math.max(dataobj.statemaxneed, dataobj.stateinfo[key].need);
    dataobj.statemaxremaining = Math.max(dataobj.statemaxremaining, dataobj.stateinfo[key].remaining);
    // console.log(key, dataobj.stateinfo[key]);
  };
  // probably do not need, remove after more testing
  // dataobj.mapcolors = d3.scaleLinear().domain([0,dataobj.statemaxneed]).range(['#ffffff','#ff4466']);
  // now can set some info
  $('#kidcount').text((Math.round((dataobj.kidstotal-499) / 1000) * 1000).toLocaleString('en'));
  // $('#mapctrl-infoblock').text(`${(dataobj.kidstotal-dataobj.kidsmatched).toLocaleString('en')} UNMATCHED CHILDREN REMAIN IN THE U.S.`)
  $('#mapctrl-infoblock').text(`${(dataobj.kidstotal-dataobj.kidsmatched).toLocaleString('en')} unassigned children remain in the U.S.`)

};

function showcountyinfo(pvalue) {
  let statename = $('#statepicker').val();
  for (let i=0; dataobj.countyinfo.length; i++) {
    if (dataobj.countyinfo[i].state == statename && dataobj.countyinfo[i].county == pvalue) {
      $('#countydetails').text(`Signed up: ${dataobj.countyinfo[i].need}, ` + 
                                  `Assigned: ${dataobj.countyinfo[i].assigned}, ` + 
                                  `Unassigned: ${dataobj.countyinfo[i].remaining}`);
      // try some animation to draw attention to the numbers. Removing and adding class to get it to fire
      $('#countydetails').removeClass('countyborder-anim');
      void document.getElementById('countydetails').offsetWidth;
      $('#countydetails').addClass('countyborder-anim');
      break;
    };
  };
};

function numbersviewchange(optpick) {
  dataobj.dataviewtype = optpick.value;
  if (optpick.value == 'remaining') {
    $('#scalelowtext').text('Less Need');
    $('#scalehightext').text('More Need');  
  } else {
    $('#scalelowtext').text('Fewer Assigned');
    $('#scalehightext').text('More Assigned');  
  };
  
  // call a function to update the #mapctrl-infoblock
  infoblockupdate(optpick);

  // now do the redrawing - code in drawing functions should account for view type
  if (dataobj.viewlevel == 'nation') {
    drawnation();
  } else {
    // recall the .viewlevel is set to the state name if not nation, so draw the right state
    drawonestate(dataobj.viewlevel);
  }
};

function infoblockupdate() {
  //   look at the view type ('remaining' or 'base'), and the view level ('national' or <statename>) and update the
  // text of the main info block (the background red div)
  if (dataobj.viewlevel == 'nation') {
    if (dataobj.dataviewtype == 'remaining') {
      $('#mapctrl-infoblock').text(`${(dataobj.kidstotal-dataobj.kidsmatched).toLocaleString('en')} unassigned children remain in the U.S.`);
    } else {
      $('#mapctrl-infoblock').text(`To date ${(dataobj.kidsmatched).toLocaleString('en')} children have been assigned`);
    }
  } else {
    // get the kid counts for the state and update the mapctrl-infoblock text
    if (dataobj.dataviewtype == 'remaining') {
      $('#mapctrl-infoblock')
      .text(`${(dataobj.stateinfo[dataobj.viewlevel].remaining).toLocaleString('en')} unassigned children remain in ${dataobj.viewlevel}`);
    } else {
      $('#mapctrl-infoblock')
      .text(`${(dataobj.stateinfo[dataobj.viewlevel].assigned).toLocaleString('en')} children have been served in ${dataobj.viewlevel}`);
    };
  }
}

function setview2nation() {
  // resets the page to display the nation
  // set the state selection to 'nothing'. Assumption: the first state option is '-Select State-'
  document.getElementById('statepicker').options[0].selected = true;
  // setting selected above does not fire onchange event, so call nation drawing
  drawnation();
};
