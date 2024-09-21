import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ZeroKnowledgeAuth from "./ZeroKnowledgeAuth";
import Checkout from "./Checkout";

function App() {
  return (
      <Routes>
        <Route path="/" element={<ZeroKnowledgeAuth />} />
        <Route path="/paymentgateway" element={<Checkout />} />
      </Routes>
  );
}

export default App;
