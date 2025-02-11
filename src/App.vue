<template>
  <div class="app-container">
    <router-view></router-view>
  </div>
</template>

<style>
/* Styles globaux */
body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, 
    #000033 0%,
    #000066 20%,
    #000080 50%,
    #000066 80%,
    #000033 100%
  );
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-container {
  min-height: 100vh;
  height: fit-content;
  padding: 0;
  box-sizing: border-box;
  background-color: rgba(0, 0, 51, 0.6);
}

/* Personnalisation de la barre de défilement */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #000066;
}

::-webkit-scrollbar-thumb {
  background: #4169e1;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #1e90ff;
}
</style> 