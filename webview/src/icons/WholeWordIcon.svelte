<script lang="ts">
    export let active = false;
</script>

<svg
    class="icon {active ? 'active' : ''}"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    ><path
        d="M64 822.6h896V655.3h-56.7v113.5H120.7V655.3H64v167.3z m382.3-367.3c0-75.7-35.8-113.5-107.5-113.5s-74.7 9-104.5 26.9v50.8c29.9-23.9 62.7-35.8 98.6-35.8s65.7 25.9 65.7 77.7L306 473.3c-67.7 10-101.5 43.8-101.5 101.5s8.5 47.3 25.4 64.2c16.9 16.9 41.3 25.4 73.2 25.4s72.7-18.9 92.6-56.7h3v47.8h47.8V455.4z m-47.8 74.6c0 27.9-8 50.3-23.9 67.2-15.9 16.9-36.8 25.4-62.7 25.4s-31.9-5-41.8-14.9-14.9-21.9-14.9-35.8c0-21.9 5.5-36.8 16.4-44.8 11-8 28.4-12.9 52.3-14.9l74.7-11.9v29.9z m188.2 80.7c21.9 35.8 53.8 53.8 95.6 53.8s75.2-15.4 100.1-46.3c24.9-30.9 37.3-72.2 37.3-123.9s-11-85.1-32.9-112c-21.9-26.9-52.8-40.3-92.6-40.3s-83.6 19.9-107.5 59.7V201.5h-50.8v454h50.8v-44.8z m0-122.5c0-29.9 8.5-54.8 25.4-74.7 16.9-19.9 39.3-29.9 67.2-29.9s49.8 9.5 65.7 28.4c15.9 18.9 23.9 45.3 23.9 79.1s-8.5 74.2-25.4 97.1-40.3 34.3-70.2 34.3-46.8-9-62.7-26.9c-15.9-17.9-23.9-39.8-23.9-65.7V488z"
    ></path></svg
>

<style>
    svg {
        fill: currentColor;
        opacity: 0.7;
        border: 1px solid transparent;
        border-radius: 3px;
        padding: 1px;
        width: 16px;
        height: 16px;
    }

    svg.active {
        opacity: 1;
        fill: var(--vscode-button-background);
        border-color: var(--vscode-button-background);
        background-color: rgba(14, 99, 156, 0.1);
    }
</style>
