clear
clc

% Initialize the cell array to store the cleaned matrices
raster_data_list = {};

% List of tif files (adjust the path as needed)
tif_files = dir('*.tif'); % Adjust directory path
% Loop through each tif file
for i = 1:length(tif_files)
    disp(i);
    % Read the raster file as a matrix
    [raster_data,R] = readgeoraster(fullfile(tif_files(i).folder, tif_files(i).name));
    
    [rows, cols, bands] = size(raster_data);
    % Convert raster to matrix (if needed, depends on the format of the raster data)
    raster_matrix_2d = reshape(raster_data, rows * cols, bands); % Assuming 'r' is already a matrix

    % Remove rows with NaN values
    cleaned_matrix = raster_matrix_2d(~any(isnan(raster_matrix_2d), 2), :);

    % Append the cleaned matrix to the list
    raster_data_list{end+1} = cleaned_matrix;
end

% Combine all cleaned matrices by rows
combined_matrix = vertcat(raster_data_list{:});

% Save the combined matrix to a .mat file
save('all_pixel_watermask2000.mat', 'combined_matrix','-mat','-v7.3');

% Display a message
disp('Combined matrix saved to combined_matrix.mat');
