const DeviceDetector = require('device-detector-js');

const getDeviceDetails = (userAgent) => {
  if (!userAgent) return { os: 'Unknown OS', browser: 'Unknown Browser', device: 'Unknown Device' };
  
  const deviceDetector = new DeviceDetector();
  const result = deviceDetector.parse(userAgent);
  
  // Get OS info
  const os = result.os ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS';
  
  // Get browser info
  const browser = result.client ? `${result.client.name} ${result.client.version || ''}`.trim() : 'Unknown Browser';
  
  // Get device info
  let deviceName = 'Unknown Device';
  if (result.device) {
    if (result.device.brand && result.device.model) {
      deviceName = `${result.device.brand} ${result.device.model}`;
    } else if (result.device.type) {
      // If specific device model isn't available, use the type (desktop, smartphone, etc.)
      deviceName = result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1);
    }
  }
  
  // Create a readable string for display
  const deviceString = `${browser} on ${os} (${deviceName})`;
  
  return { 
    os, 
    browser,
    device: deviceName,
    full: deviceString
  };
};

module.exports = getDeviceDetails;