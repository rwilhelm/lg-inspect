/* jshint strict:true, devel:true, debug:true */
/* globals angular, app, d3, L, React, chart, minimap */
'use strict'; // jshint -W097

// app.directive('minimapPreview', ['$window',
//   function($window) {
//     return {
//       restrict: 'EA',
//       replace: true,
//       scope: {har: '=', domain: '='},
//       link: function($scope, $element, $attributes) {
//         var minimapPreview = d3.custom.minimapPreview();
//         var minimapPreviewElement = d3.select($element[0]); // brush's 'this' in selection.each

//         $scope.$watchCollection('[data.domain.x, data.domain.y, har]', function(val, oldVal) {
//           console.log('almost...');
//           if ($scope.har && $scope.data.domain.x.length && $scope.data.domain.y.length) {
//             console.log(' ready!');
//             minimapPreviewElement
//             .datum({domain: $scope.data.domain, har: $scope.har})
//             .call(minimapPreview);
//           }
//         });
//       }
//     };
//   }
// ]);

app.directive('minimap', [
  function () {
    return {
      restrict: 'E',
      scope: { trip: '=', sensor: '@', updateExtent: '&', loadMoreData: '&' },
      link: function($scope, $element, $attributes) {
        console.log('chart directive:', $scope.sensor);

        // FIXME listen, don't watch (is that even possible?)
        $scope.$watchCollection('[trip.data.domain.x, trip.data.domain.y]', function(val, oldVal) {
          if ($scope.trip && $scope.trip.data.domain.x.length && $scope.trip.data.domain.y.length && $scope.trip.data.harSummarized.length) {
            React.renderComponent(
              minimap({
                extent  : $scope.trip.data.extent,
                xDomain : $scope.trip.data.domain.x,
                yDomain : $scope.trip.data.domain.y,
                data    : $scope.trip.data.harSummarized,
                loadMoreData: function(extent, oldExtent) {
                  $scope.loadMoreData({extent: extent, oldExtent: oldExtent});
                },
                updateExtent: function(extent) {
                  $scope.updateExtent({extent: extent});
                },
              }), $element[0]
            );
          }
        });
      }
    };
  }
]);

app.directive('chart', [
  function () {
    return {
      restrict: 'E',
      scope: { trip: '=', sensor: '@', loadMoreData: '&' },
      link: function($scope, $element, $attributes) {
        console.log('chart directive:', $scope.sensor);

        // FIXME listen, don't watch (is that even possible?)
        $scope.$watchCollection('[trip.data.sensors[sensor], trip.data.domain.x, trip.data.domain.y, trip.data.extent]', function(val, oldVal) {
          if ($scope.trip && $scope.trip.data.sensors[$scope.sensor].length && $scope.trip.data.domain.x.length && $scope.trip.data.domain.y.length) {
            React.renderComponent(
              chart({
                sensor  : $scope.sensor,
                data    : $scope.trip.data.sensors[$scope.sensor],
                extent  : $scope.trip.data.extent,
                xDomain : $scope.trip.data.domain.x,
                yDomain : $scope.trip.data.domain.y,
                loadMoreData: function(extent, oldExtent) {
                  console.log('directive: loadMoreData', extent, oldExtent);
                  $scope.loadMoreData({extent: extent, oldExtent: oldExtent});
                },
                updateExtent: function(extent) {
                  $scope.updateExtent({extent: extent});
                },
                // onChange: handleChanges(function(extent) {
                //   $scope.trip.data.extent = extent;
                //   $scope.$apply();
                // }
              }), $element[0]
            );
          }
        });
      }
    };
  }
]);

app.directive('chartInfo', [
  function() {
    return {
      restrict: 'E',
      scope: { trip: '=', sensor: '@' },
      templateUrl: 'partial/chart-info',
      link: function ($scope, $element, $attributes) {
        $scope.name = $attributes.name;
      }
    };
  }]);

app.directive('map', [
  function () {
    return {
      restrict: 'E',
      scope: {trip: '='},
      link: function ($scope, $element, $attributes) {

        // 1. create map
        // 2. pepare activities FIXME put in trip object (all model logic in services!)
        // 2. draw geojson to map
        // 3. add legend

        var map = L.mapbox.map('map', 'rene.i6mdi15p', { // mapbox id
          legendControl: {
            position: 'topright'
          },
          zoomControl: false
        });

        new L.Control.Zoom({ position: 'topright' }).addTo(map);

        var geoJson;

        // FIXME -> HELPERS(?)
        // give array as argument (abstract!)
        // returns activities in a manually sorted order
        function sortActivities(activities) {
          var a = ['driving', 'running', 'walking', 'standing', 'sitting', 'on table', 'unknown'];
          return a.map(function (d) {
            return activities[activities.indexOf(d)];
          });
        }

        var legend = L.control({position: 'topright'});

        // requires sortActivities
        legend.onAdd = function (map) {
          // var div = L.DomUtil.create('div', 'info legend leaflet-bar', this.legend);
          var div = L.DomUtil.create('div', 'info legend leaflet-bar');

          // sort activities before generating legend
          var a = sortActivities(activities).filter(function (n) { return n; });

          for (var i = 0; i < a.length; i++) {
            div.innerHTML += '<i style="background:' + getColor(a[i]) + '"></i>' + a[i] + '<br>';
          }

          return div;

        };

        function onEachFeature(feature, layer) {

          // create a popup for each feature
          if (feature.properties) {
            var popupString = '<div class="popup">';
            for (var k in feature.properties) {
              var v = feature.properties[k];
              if (k == 't0' || k == 't1') v = moment.unix(parseInt(v)).utc().format("HH:mm:ss");
              if (k == 'distance')        v = Math.round(v * 100, 12) / 100 + " m";
              if (k == 'duration')        v = moment.duration(v).humanize();
              if (k == 'speed')           v = v + ' km/h';
              popupString += k + ': ' + v + '<br />';
            }
            popupString += '</div>';
            layer.bindPopup(popupString, {
              maxHeight: 200
            });
          }

          // highlight feature on mouseover
          layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
          });

        }




      function resetHighlight(e) {
        geoJson.resetStyle(e.target);
      }


      // required by style
      function getColor(d) {
        switch (d) {
          case 'driving'  : return '#377eb8';
          case 'running'  : return '#e41a1c';
          case 'walking'  : return '#ff7f00';
          case 'standing' : return '#4daf4a';
          case 'sitting'  : return '#984ea3';
          case 'on table' : return '#a65628';
          case 'unknown'  : return '#777777';
          case null       : return '#777777';
        }
      }

      // requires getColor
      function style(feature) {
        return {
          weight: 8,
          opacity: 0.7,
          color: getColor(feature.properties.activity)
        };
      }

      function highlightFeature(e) {
        var layer = e.target;

        layer.setStyle({
          weight: 10,
          opacity: 1
        });

        if (!L.Browser.ie && !L.Browser.opera) {
          layer.bringToFront();
        }
      }




      $scope.$watchCollection('[trip, trip.data.geo]', function(val, oldVal) {
        if ($scope.trip && $scope.trip.data && $scope.trip.data.geo && Object.keys($scope.trip.data.geo).length) {
          console.log('geo data is ready!', $scope.trip.data.geo);

            var activities = $scope.trip.data.geo.features.map(function (d) {
              return d.properties.activity;
            });

            // FIXME -> HELPERS
            activities[activities.indexOf(null)] = "unknown"; // change null to "unknown"

            // FIXME -> HELPERS
            activities = activities.sort().filter(function (el, i, a) {
              if (i == a.indexOf(el)) return 1;
              return 0;
            }); // sort unique

            // FIXME -> HELPERS
            activities.filter(function (n) {
              return n;
            }); // remove undefined


          // map.featureLayer.setGeoJSON(val);

          // legend.addTo(document.getElementById('legend').innerHTML);

          // Draw geoJSON object to map
          geoJson  = L.geoJson($scope.trip.data.geo, {
            style: style,
            onEachFeature: onEachFeature
          }).addTo(map);

          // Zoom map to fit our route
          map.fitBounds(geoJson.getBounds());
          // drawLegend();
          // debugger
          // map.legendControl.addLegend(legend);
          // map.addControl(L.mapbox.legendControl());
          // map.legendControl.addLegend(document.getElementById('legend').innerHTML);

        } else {
          console.log('no geo data');
        }
      });



      // // Draw geoJSON object to map
      // var geoJson = L.geoJson(data, {
      //   style: style,
      //   onEachFeature: onEachFeature
      // }).addTo(map);

      // // Zoom map to fit our route
      // map.fitBounds(geoJson.getBounds());
    } // end link
  }; // end return
}]);