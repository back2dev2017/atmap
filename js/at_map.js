function initialsetup() {
  // kick off async loading the county data, but since it is a promise, this keeps going in parallel
  loadstatecounties();
  // note: this may be a good place to kick off loading children info, but for now, because doing test data
  // using random numbers, this had to be placed in the load of the counties
  // loadchilddata();

  // set up general global variables used for any drawing, color, etc
  dataobj.boxwidth =  $('#mapcontainer').width();
  dataobj.boxheight = dataobj.boxwidth * (6/9);
  dataobj.dataviewtype = 'base'; // 'base' shows number of signed up and number served, 'remaining' is other view
  // do some visual clean-up and preparation
  $('#mapnote').width(dataobj.boxwidth - 20);
  $('#scale').css({display: 'flex'});
};

function loadnationstates() {
  let jsondatafile = './topojson/us-albers-1.json';
  d3.json(jsondatafile).then(function(data) {
    // assign the data pulled in to a global object - do not have to load again
    dataobj.countrydata = data;
    dataobj.drawcountry = topojson.feature(data, data.objects.us); // for us-albers-1 (subobjs)
    // draw the nation - state level
    drawnation();
    // add the states to the list of available states to pick from
    setupstatepicker(dataobj.drawcountry);
  });
}

function setupcountypick(pstatename) {
  dataobj.countylist = [];
  dataobj.countyinfo.forEach(function(item) {
    if (item.state == pstatename) {
      console.log(pstatename);
      dataobj.countylist.push(item.county);
    };
  });
  dataobj.countylist.sort();

  // empty out the county dropdown - in case it was previously picked
  $('#countypicker').empty(); // jQuery empty() is nice and quick
  let pickertemp = document.getElementById('countypicker');
  let tmpitem = document.createElement('option');
  tmpitem.text = '-Select a County-';
  tmpitem.value = '--';
  pickertemp.add(tmpitem);
  dataobj.countylist.forEach(function(item) {
    tmpitem = document.createElement('option');
    tmpitem.text = item;
    tmpitem.value = item;
    pickertemp.add(tmpitem);
  });

}

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
    // do not want to draw nation until we had that - ref color 'range' function
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
  $('#labeltip').css({left: event.pageX + 'px', top: event.pageY + 'px'});
  $('#mainline').text(d.properties.name);
  let [theneed, theassigned, theremaining] = [dataobj.stateinfo[d.properties.name].need.toLocaleString('en'), 
                                              dataobj.stateinfo[d.properties.name].assigned.toLocaleString('en'), 
                                              dataobj.stateinfo[d.properties.name].remaining.toLocaleString('en')]; 
  $('#subline').html('Signed up: ' + theneed + '<br>Served: ' + theassigned);

};

function mycountyhover (d) {
  // mydiv.style.left = event.pageX + 'px';
  // mydiv.style.top = event.pageY + 'px';
  // console.log(d);
  // recall that the pop-up label should have been hidden at the national level - display it now
  $('#labeltip').css({display: 'flex', height:'40px'});
  // set the info for the 'hovered' county
  $('#labeltip').css({left: event.pageX + 'px', top: event.pageY + 'px'});
  $('#mainline').text(d.properties.name);
  let [theneed, theassigned, theremaining] = (typeof(d.need) == "undefined" ? [0, 0, 0]: [d.need, d.assigned, d.assigned - d.need]);
  $('#subline').text('Signed up: ' + theneed + ', Served: ' + theassigned);
  // $('#subline').text('Remaining need: ' + theremaining);
}

function setupstatepicker (mycountrydata) {
  // the passed data is specifically USA json topojson data, so need to pull states from that
  // the global 'statelist' array will hold all the states
  mycountrydata.features.forEach(function(item) {
    dataobj.statelist.push(item.properties.name);
  });
  // want the states to be sorted, so had to create that array first, now we'll sort and add
  dataobj.statelist.sort();
  // the DOM SELECT element to pick states has an ID of 'statepicker'
  let statedropdown = document.getElementById('statepicker');
  let tmpselitem = document.createElement('option');
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

function drawnation() {
  // assumes data has been loaded and set up in dataobj.drawcountry
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
      // console.log(d);
      return dataobj.mapcolors(dataobj.stateinfo[d.properties.name].need);})
    .on('mouseover', mystatehover)
    .on('click', mystateclick);

  country.exit().remove();

};

function drawonestate(statename) {
  console.log(statename);
  // if the '--' selection was picked from the state dropdown, draw the nation
  if (statename.includes('--')) {
    drawnation();
  } else {
    // let mydata = [];
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
            if (typeof(dataobj.countyinfo[i].assigned) == "undefined") {
              tmpitem['need'] = 0;
              tmpitem['assigned'] = 0;
              tmpitem['remaining'] = 0;
              break;
            } else {
            tmpitem['need'] = dataobj.countyinfo[i].need;
            tmpitem['assigned'] = dataobj.countyinfo[i].assigned;
            tmpitem['remaining'] = dataobj.countyinfo[i].remaining;
            // console.log('yep found match: ' + item.properties.state + ' ' + item.properties.name);
            break;
            };
          };
        };
        // console.log(tmpitem);
        return tmpitem;
      };
    });
    tempstate.type = 'FeatureCollection';
    tempstate.features = mydata;
    
    dataobj.tmpmaxneed = 0;
    mydata.forEach(function(item) {
      dataobj.tmpmaxneed = Math.max(dataobj.tmpmaxneed, item.need);
    });
    
    // set up the scale for colors
    dataobj.statecolors = d3.scaleLinear().domain([0,dataobj.tmpmaxneed]).range(['#ffffff','#ff4466']);
    
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
        return dataobj.statecolors(d.need);
      })
      .on('mouseover', mycountyhover);
      // .on('click', mystateclick);

    drawitem.exit().remove();
    
    // show the "National View" div, clear any pop-up (may have been hovering over a different state)
    $('#back2nation').css({display: 'block'});
    $('#labeltip').css({display: 'none'});
    $('#countyselection').css({display: 'flex'});
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
  });

  let cntyassigned = cntyneed = 0;
  dataobj.statedata.objects.collection.geometries.forEach(function(item) {
    // randomize a need, then randomize assigned (always <= need)
    cntyneed = Math.round(Math.random() * 180);
    cntyassigned = Math.round(Math.random() * cntyneed);
    // add the info to the countinfo array - an object {state, county, need, assigned}
    let tmpobj = {'county':item.properties.name, 
                  'state':item.properties.state, 
                  'assigned':cntyassigned, 
                  'need':cntyneed, 
                  'remaining':cntyneed-cntyassigned
                };
    dataobj.countyinfo.push(tmpobj);
    // add info to the state summing - note the "+=" syntax - calculating on the fly so do not have to loop through again later
    dataobj.stateinfo[item.properties.state].need += cntyneed;
    dataobj.stateinfo[item.properties.state].assigned += cntyassigned;
    dataobj.stateinfo[item.properties.state].remaining += (cntyneed - cntyassigned);
  });

  // now that we have the numbers and counts, we will set up the national level 'color scale'
  dataobj.statemaxneed = 0;
  for (let key of Object.keys(dataobj.stateinfo)) {
    dataobj.statemaxneed = Math.max(dataobj.statemaxneed, dataobj.stateinfo[key].need);
    dataobj.statemaxremaining = Math.max(dataobj.statemaxremaining, dataobj.stateinfo[key].remaining);
    // console.log(key, dataobj.stateinfo[key]);
  };
  dataobj.mapcolors = d3.scaleLinear().domain([0,dataobj.statemaxneed]).range(['#ffffff','#ff4466']);
};


function numbersviewchange(optpick) {
  dataobj.dataviewtype = optpick.value;
  // now do the redrawing - code in drawing functions should account for view type  
}