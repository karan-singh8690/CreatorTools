#!/bin/bash

# Install dependencies for all mini-services.

# Config
ROOT_DIR="/home/z/my-project/mini-services"

main() {
    echo "Starting batch dependency install..."

    # Check if the source directory exists
    if [ ! -d "$ROOT_DIR" ]; then
        echo "Directory $ROOT_DIR does not exist, skipping install."
        return
    fi

    # Counters
    success_count=0
    fail_count=0
    failed_projects=""

    # Iterate over every subdirectory in mini-services
    for dir in "$ROOT_DIR"/*; do
        # Only process directories that contain a package.json
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            echo ""
            echo "Installing dependencies: $project_name..."

            # Run bun install inside the project directory
            if (cd "$dir" && bun install); then
                echo "  $project_name dependencies installed"
                success_count=$((success_count + 1))
            else
                echo "  $project_name dependency install FAILED"
                fail_count=$((fail_count + 1))
                if [ -z "$failed_projects" ]; then
                    failed_projects="$project_name"
                else
                    failed_projects="$failed_projects $project_name"
                fi
            fi
        fi
    done

    # Summary
    echo ""
    echo "=================================================="
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "Install complete!"
        echo "Succeeded: $success_count"
        if [ $fail_count -gt 0 ]; then
            echo "Failed: $fail_count"
            echo ""
            echo "Failed projects:"
            for project in $failed_projects; do
                echo "  - $project"
            done
        fi
    else
        echo "No projects with package.json found."
    fi
    echo "=================================================="
}

main
