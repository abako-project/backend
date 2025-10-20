const puppeteer = require('puppeteer');

describe('Virto Connect Demo Flow', () => {
  let browser;
  let page;
  
  const testUsername = Array.from({length: 4}, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');

  beforeAll(async () => {
    const isCI = process.env.CI === 'true';
    browser = await puppeteer.launch({
      headless: isCI ? 'new' : false,
      executablePath: isCI ? undefined : '/usr/bin/brave-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        ...(isCI ? [] : ['--auto-open-devtools-for-tabs'])
      ],
      slowMo: 50,
      devtools: !isCI
    });
    
    page = await browser.newPage();
    
    await page.evaluate(() => {
      setTimeout(() => {
        DevTools.showPanel('network');
      }, 1000);
    });
    
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);
  });

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  afterAll(async () => {
    await browser.close();
  });
  
  test('Complete Virto Connect demo flow', async () => {
    const url = 'http://localhost:3001/example.html';
    await page.goto(url, { waitUntil: 'networkidle0' });
    console.log(' Loaded example.html from server');

    console.log('⏳ Configuring WebAuthn virtual authenticator...');
    
    await page.evaluate(() => {
      if (!window.internals) {
        console.warn("WebAuthn testing APIs are not available. Continuing without WebAuthn setup.");
        return;
      }
      
      window.internals.setWebAuthenticationServiceForTesting(true);
    });
    
    const cdpSession = await page.target().createCDPSession();
    
    await cdpSession.send('WebAuthn.enable');
    
    const authenticatorId = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true
      }
    });
    console.log(' WebAuthn virtual authenticator configured:', authenticatorId.authenticatorId);

    await sleep(2000);

    await page.waitForSelector('#hero-demo-btn', { visible: true });
    await page.click('#hero-demo-btn');
    console.log(' Clicked on hero demo button');
    
    await page.waitForSelector('#connect-button:not([disabled])');
    await page.click('#connect-button');
    
    await sleep(5000);
    
    const formStructure = await page.evaluate(() => {
      const virtoConnect = document.querySelector('virto-connect');
      if (!virtoConnect) return 'No virto-connect element found';
      
      const shadowRoot = virtoConnect.shadowRoot;
      if (!shadowRoot) return 'No shadow root found';
      
      const forms = Array.from(shadowRoot.querySelectorAll('form'))
        .map(form => ({
          id: form.id,
          inputs: Array.from(form.querySelectorAll('virto-input')).map(input => ({
            name: input.getAttribute('name'),
            label: input.getAttribute('label')
          }))
        }));
      
      return forms;
    });
    
    console.log('Form structure in Shadow DOM:', JSON.stringify(formStructure, null, 2));
    
    await page.waitForFunction(() => {
      const virtoConnect = document.querySelector('virto-connect');
      if (!virtoConnect) return false;
      const shadowRoot = virtoConnect.shadowRoot;
      if (!shadowRoot) return false;
      return shadowRoot.querySelector('#register-form') !== null;
    });
    console.log(' Registration form found in Shadow DOM');
    
    await page.evaluate((username) => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      
      const nameInput = shadowRoot.querySelector('#register-form virto-input[name="name"]');
      if (nameInput) {
        nameInput.value = 'Test User';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        console.error('Name input not found');
      }
      
      const usernameInput = shadowRoot.querySelector('#register-form virto-input[name="username"]');
      if (usernameInput) {
        usernameInput.value = username;
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        console.error('Username input not found');
      }
    }, testUsername);
    console.log(' Filled registration form');
    
    await page.evaluate(() => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      const registerButton = shadowRoot.querySelector('#action-button');
      if (registerButton) {
        registerButton.click();
      } else {
        console.error('Register button not found');
      }
    });
    console.log(' Clicked register button');

    await page.waitForFunction(() => {
      const virtoConnect = document.querySelector('virto-connect');
      if (!virtoConnect) return false;
      const shadowRoot = virtoConnect.shadowRoot;
      if (!shadowRoot) return false;
      return shadowRoot.querySelector('#sign-in-button') !== null;
    });
    console.log(' Registered new user successfully');

    await page.evaluate(() => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      const signInButton = shadowRoot.querySelector('#sign-in-button');
      if (signInButton) {
        signInButton.click();
      } else {
        console.error('Sign In Now button not found');
      }
    });
    console.log(' Clicked Sign In Now button');
    
    await page.waitForFunction(() => {
      const virtoConnect = document.querySelector('virto-connect');
      if (!virtoConnect) return false;
      const shadowRoot = virtoConnect.shadowRoot;
      if (!shadowRoot) return false;
      return shadowRoot.querySelector('#login-form') !== null;
    });
    console.log(' Login form found in Shadow DOM');
    
    await page.evaluate((username) => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      
      const usernameInput = shadowRoot.querySelector('#login-form virto-input[name="username"]');
      if (usernameInput) {
        usernameInput.value = username;
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        console.error('Username input not found');
      }
    }, testUsername);
    console.log(' Filled login form');
    
    await page.evaluate(() => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      const loginButton = shadowRoot.querySelector('#action-button');
      if (loginButton) {
        loginButton.click();
      } else {
        console.error('Login button not found');
      }
    });
    console.log(' Clicked login button');
    
    await page.waitForSelector('#extrinsic-section', { visible: true });
    console.log(' Logged in successfully');

    await page.evaluate(() => {
      const virtoConnect = document.querySelector('virto-connect');
      const shadowRoot = virtoConnect.shadowRoot;
      const closeButton = shadowRoot.querySelector('virto-button');
      if (closeButton) {
        closeButton.click();
      } else {
        console.error('Close button not found');
      }
    });
    console.log(' Clicked close button');
    
    await page.evaluate(() => {
      const transferAction = document.querySelector('[data-action="transfer"]');
      if (transferAction) {
        transferAction.click();
      } else {
        console.error('Transfer action not found');
      }
    });
    console.log(' Clicked transfer action');
    
    await page.waitForSelector('#transfer-button', { visible: true });
    console.log(' Transfer button found');
    
    await page.click('#transfer-button');
    console.log(' Clicked transfer button to process payment');
    
    await page.waitForSelector('.success-notification', { visible: true });
    console.log(' Signed extrinsic successfully');
    
    await cdpSession.send('WebAuthn.removeVirtualAuthenticator', {
      authenticatorId: authenticatorId.authenticatorId
    });
    
    await sleep(3000);
  }, 240000); 
});
