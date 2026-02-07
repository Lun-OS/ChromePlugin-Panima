[中文版](README_zh-CN.md)

# 爬逆马 (Panima) - Network Traffic Capture Extension

## Project Name
爬逆马 (Panima)

## Description
"爬逆马" (Panima) is a Chrome browser extension designed to monitor and capture network traffic, including JavaScript files, CSS, HTML, images, videos, and other resources, as well as WebSocket frames. It allows users to save the captured data as a local ZIP file for reverse engineering analysis.

## Features
*   **Comprehensive Network Capture**: Monitors and captures various types of network resources (JS, CSS, HTML, images, videos, others) and raw network packets.
*   **WebSocket Frame Capture**: Records WebSocket messages (sent and received) for detailed analysis.
*   **Selective Filtering**: Users can choose which types of resources to capture through a user-friendly popup interface.
*   **Automatic ZIP Export**: All captured data is compiled into a single ZIP archive for easy download and offline analysis.
*   **Cache Bypassing**: Disables browser cache during capture to ensure all resources are fetched and recorded.
*   **Detailed Request/Response Data**: Captures full request and response headers, methods, URLs, status codes, and post data.

## How to Use

### Installation
1.  **Download the extension**: Obtain the extension files (usually a `.zip` file containing the `manifest.json`, `background.js`, `popup.html`, `popup.js`, etc.).
2.  **Unpack the extension**: Extract the downloaded ZIP file to a local folder.
3.  **Open Chrome Extensions page**:
    *   Open Chrome browser.
    *   Type `chrome://extensions` in the address bar and press Enter.
4.  **Enable Developer Mode**:
    *   Toggle on the "Developer mode" switch, usually located in the top right corner of the Extensions page.
5.  **Load Unpacked**:
    *   Click the "Load unpacked" button.
    *   Select the folder where you extracted the extension files.
6.  **Pin the extension (optional)**: For easy access, click the puzzle piece icon in the Chrome toolbar and pin the "爬逆马" extension.

### Capturing Network Traffic
1.  **Navigate to the target page**: Open the web page you wish to monitor in a new Chrome tab.
2.  **Open the extension popup**: Click on the "爬逆马" extension icon in your Chrome toolbar.
3.  **Select Filters**: In the popup window, choose the types of resources you want to capture (e.g., JS, CSS, HTML, Images, Videos, Packets, Other).
4.  **Start Capture**: Click the "开始爬取" (Start Crawl) button. The status will change to "爬取中" (Crawling).
    *   The extension will automatically reload the current tab to begin capturing all network activity from the start.
5.  **Browse the page**: Interact with the web page as needed to trigger the network requests you want to capture.
6.  **Stop Capture**: Once you have finished browsing or captured enough data, click the "停止爬取" (Stop Crawl) button in the extension popup. The status will change to "空闲" (Idle).
7.  **Download ZIP**: A "Save As" dialog will appear, prompting you to save the captured data as a ZIP file (e.g., `panima_YYYYMMDD_HHMMSS.zip`). Choose a location and save the file.

### Analyzing Captured Data
The downloaded ZIP file will contain:
*   **Resource Files**: Folders organized by domain, containing captured JS, CSS, HTML, image, video, and other binary files.
*   **`packets/requests.json`**: A JSON file containing detailed information about all captured network requests, responses, and WebSocket frames. This includes URLs, methods, headers, status codes, post data, and WebSocket payload data.

## Permissions
This extension requires the following permissions:
*   **`debugger`**: Allows the extension to attach to tabs and monitor network activity.
*   **`downloads`**: Enables the extension to download the captured ZIP file to your computer.
*   **`storage`**: Used to store user preferences (e.g., selected filters).
*   **`tabs`**: Allows the extension to query and reload tabs.
*   **`host_permissions` (`<all_urls>`)**: Grants access to monitor network requests on all URLs.

## Development
This extension is developed using standard Web Extension APIs.
*   `background.js`: The service worker script responsible for attaching to the debugger, capturing network events, processing data, and building the ZIP file.
*   `popup.html`: The HTML structure for the extension's popup interface.
*   `popup.js`: The JavaScript for the popup, handling user interactions and communicating with the background script.
*   `manifest.json`: Defines the extension's metadata, permissions, and entry points.

---
By: Lun.
