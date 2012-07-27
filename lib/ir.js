var Board = require("../lib/board.js"),
    events = require("events"),
    util = require("util"),
    __ = require("../lib/fn.js"),
    es6 = require("es6-collections"),
    WeakMap = es6.WeakMap


var DeviceMap,
    priv = new WeakMap();

DeviceMap = {
  /**
   * Sharp GP2Y0D805Z0F IR Sensor
   * 0×20, 0×22, 0×24, 0×26
   *
   * http://osepp.com/products/sensors-arduino-compatible/osepp-ir-proximity-sensor-module/
   *
   *
   * http://sharp-world.com/products/device/lineup/data/pdf/datasheet/gp2y0d805z_e.pdf
   *
   */

  "GP2Y0D805Z0F": {
    type: "proximity",
    address: 0x26,
    bytes: 1,
    delay: 250,

    // read request data handler
    data: function( read, data ) {
      var state = priv.get( this ).state,
          value = data[ 0 ],
          timestamp = new Date(),
          err = null;

      if ( value !== state && value === 1 ) {
        this.emit( "motionstart", err, timestamp );
      }

      if ( state === 1 && value === 3 ) {
        this.emit( "motionend", err, timestamp );
      }

      priv.set( this, {
        state: value
      });
    },

    // These are added to the property descriptors defined
    // within the constructor
    // descriptor: {
    //   state: {
    //     get: function() {
    //       return priv.get( this ).state;
    //     }
    //   }
    // },
    //
    setup: [
      // CRA
      [ 0x3, 0xFE ]
    ],
    preread: [
      [ 0x0 ]
    ]
  },

  "QRE1113GR": {
    // http://www.pololu.com/file/0J117/QRE1113GR.pdf
    type: "reflect",
    address: 0x4B,
    bytes: 2,
    delay: 100,

    // read request data handler
    data: function( data ) {
      var temp = {
            left: data[0],
            right: data[1]
          };

      // if ( temp.left < 200 ) {
      //   this.emit( "left", err, timestamp );
      // }

      // if ( temp.right < 200 ) {
      //   this.emit( "right", err, timestamp );
      // }


      priv.set( this, temp );
    },


    setup: [
      // Reset the ADC (analog-to-digital converter)
      // NXP PCA969
      [ 0x0, 0x0 ]
    ],
    preread: [
      // left, right
      [ 0x0, 0x1 ]
    ]
  }
};



function IR( opts ) {

  if ( !(this instanceof IR) ) {
    return new IR( opts );
  }

  var address, bytes, device, delay,
      last, properties, preread, read, setup;

  opts = Board.options( opts );

  // Hardware instance properties
  this.board = Board.mount( opts );
  this.firmata = this.board.firmata;

  device = DeviceMap[ opts.device ];

  address = opts.address || device.address;
  bytes = device.bytes;
  data = device.data;
  delay = device.delay;
  setup = device.setup;
  // descriptor = device.descriptor;
  preread = device.preread;

  // Read event throttling
  this.freq = opts.freq || 500;

  // Make private data entry
  priv.set( this, {
    state: 0
  });

  // Set up I2C data connection
  this.firmata.sendI2CConfig();

  // Iterate and write each set of setup instructions
  setup.forEach(function( byteArray ) {
    this.firmata.sendI2CWriteRequest( address, byteArray );
  }, this);

  // Read Request Loop
  setInterval(function() {
    // Set pointer to X most signficant byte/register
    this.firmata.sendI2CWriteRequest( address, preread );

    // Read from register
    this.firmata.sendI2CReadRequest( address, bytes, data.bind(this) );

  }.bind(this), delay );

  // Continuously throttled "read" event
  setInterval(function() {
    this.emit( "read", null, new Date() );
  }.bind(this), this.freq );


  Object.defineProperties( this, {
    left: {
      get: function() {
        return priv.get( this ).left;
      }
    },
    right: {
      get: function() {
        return priv.get( this ).right;
      }
    }
  });
};


util.inherits( IR, events.EventEmitter );

module.exports = IR;