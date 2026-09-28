# Federated File System (FFS) API Documentation

The FFS API provides HTTP endpoints for file and directory management on ESP32/ESP8266 devices. It supports LittleFS and SD (ESP32 only), federation, and is designed to be robust and portable.

## Endpoints

### Directory Operations

- **Create Directory**
  - `POST /ffs/mkdir?dir=<path>`
  - `GET /ffs/mkdir?dir=<path>`
  - Creates a directory at the given path.
  - The path can be with or without a leading slash, such as `/zot` or `zot`.

- **Remove Directory**
  - `POST /ffs/rmdir?dir=<path>`
  - `GET /ffs/rmdir?dir=<path>`
  - Removes the directory at the given path.

### File Operations

- **Upload (Create/Overwrite) File**
  - `POST /ffs/upload?file=<path>` with file contents as the request body.
  - `GET /ffs/upload?file=<path>&body=<contents>`.
  - Creates or overwrites a file with the given contents.

- **Delete File**
  - `POST /ffs/delete?file=<path>`
  - `GET /ffs/delete?file=<path>`
  - Deletes the file at the given path.

- **Download File**
  - `GET /ffs/get?file=<path>`
  - `POST /ffs/get?file=<path>`
  - Downloads the file at the given path.

### Listing

- **List Files**
  - `GET /ffs/list`
  - Returns a JSON array of file paths.

- **List Discovered Nodes**
  - `GET /ffs/nodes`
  - Returns a JSON array of discovered node information.

## Path Handling

- All endpoints accept paths with or without a leading slash.
- For SD card access on ESP32, use paths starting with `sd/`, such as `sd/mydir`.

## Example Usage

```powershell
curl -X POST "http://<ip>/ffs/mkdir?dir=zot"
curl -X POST "http://<ip>/ffs/upload?file=myfile.txt" --data-binary "Hello"
curl "http://<ip>/ffs/get?file=myfile.txt"
curl -X POST "http://<ip>/ffs/delete?file=myfile.txt"
```

## Notes

- Responses are plain text or JSON.
- Errors return HTTP 400 or 500 with a message.
- Directory and file operations are portable across supported filesystems.
- Federation and advanced features are available through additional endpoints.