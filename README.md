# Image Graver

|![overviewImage](images/overview.png)|
| ------ |

Image Graver is an open source tool to convert images to 3d reliefs and create g-code routing information to be used with cnc routers.

The program only relies on javascript for dataprocessing and thus runs fully in your browser without the need of any additional installations. All code is provided with this project.

Tool supports conversion of color images to heightfields, 2d/3d heightfield inspection, basic image operations on the heightfield and gcode export for cnc routers.

For usage read the not yet finished [user docs](https://github.com/Lachei/ImageGraver/wiki)

## License

The program is published under the MIT License and is free to use and adpot. No guarantees given!

Retrieve a copy of the license [here](LICENSE).

## Usage

To use the website with internet connection simply click [here](https://htmlpreview.github.io/?https://github.com/Lachei/ImageGraver/blob/master/ImageGraver.html).

If no internet connection can be established simply download all source files by either clicking [here](https://github.com/Lachei/ImageGraver/archive/refs/heads/master.zip), 

or clicking the download as `.zip` button.
![Download zip](images/download_zip.png)

Unpack the downloaded `.zip` file and double click on `ImageGraver.html`. The website should then be opened in your browser.

## Roadmap

In the future i plan to include the following improvements/extensions:

- Add V-carving like F-engrave does, will depend on potrace (js port available and performant) for image to svg conversion
- Extend Info boxes for the task graph in the top of the window to include the output data format (RGB, GRAY, SVG). This wil also be needed to properly convey the information to the user to be able to use v-carving
- Increase the amount of image operations available (eg. denoising)
- Add output path reduction for all paths (needed especially for relief path creation)
- Maybe automatically avoid to create as much paths for relief