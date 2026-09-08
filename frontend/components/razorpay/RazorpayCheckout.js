import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

export const RazorpayCheckout = ({
  options,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const { handler, ...optionsWithoutHandler } = options || {};
  const optionsString = JSON.stringify(optionsWithoutHandler || {});

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background-color: transparent; }
        </style>
      </head>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          try {
            var options = ${optionsString};

            options.handler = function (response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: response
              }));
            };

            options.modal = {
              ondismiss: function () {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_CLOSED'
                }));
              }
            };

            var rzp1 = new Razorpay(options);

            rzp1.on('payment.failed', function (response) {
              try {
                var rawErr = (response && response.error) ? response.error : (response || {});
                var errorObj = {
                  code: rawErr.code || 'PAYMENT_FAILED',
                  description: rawErr.description || rawErr.message || (typeof rawErr === 'string' ? rawErr : 'Payment could not be completed'),
                  reason: rawErr.reason || 'payment_failed',
                  source: rawErr.source || 'customer',
                  step: rawErr.step || 'payment_authentication',
                  metadata: rawErr.metadata || {}
                };
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_FAILED',
                  error: errorObj
                }));
              } catch (err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_FAILED',
                  error: { description: 'Payment processing failed' }
                }));
              }
            });

            rzp1.open();
          } catch (initErr) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_FAILED',
              error: { description: initErr && initErr.message ? initErr.message : 'Failed to initialize payment' }
            }));
          }
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'PAYMENT_SUCCESS') {
        onSuccess(message.data);
      } else if (message.type === 'PAYMENT_FAILED') {
        onFailure(message.error || { description: 'Payment could not be completed' });
      } else if (message.type === 'PAYMENT_CLOSED') {
        onClose();
      }
    } catch (e) {
      console.error('[RazorpayCheckout] Failed to parse WebView message:', e);
      onFailure({ description: 'Payment processing encountered an error' });
    }
  };

  const handleNavigation = (request) => {
    const { url } = request;
    if (
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('about:blank')
    ) {
      Linking.openURL(url).catch((err) => {
        console.warn('[RazorpayCheckout] Could not open external app for URL:', url, err);
      });
      return false;
    }
    return true;
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeContainer} edges={['bottom', 'left', 'right']}>
          <WebView
            originWhitelist={[
              '*',
              'http://*',
              'https://*',
              'upi://*',
              'tez://*',
              'phonepe://*',
              'paytmmp://*',
            ]}
            source={{ html: htmlContent }}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigation}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webview}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loaderContainer}>
                <ActivityIndicator
                  size="large"
                  color={options?.theme?.color || '#3399cc'}
                />
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  safeContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1001,
  },
});

export default RazorpayCheckout;
