import React, { useState, useEffect } from "react";
import "./styles.css";
import { Magic } from "magic-sdk";
import { SolanaExtension } from "@magic-ext/solana";
import * as web3 from "@solana/web3.js";

const rpcUrl = "https://api.devnet.solana.com";

const magic = new Magic("pk_live_FCF04103A9172B45", {
  extensions: {
    solana: new SolanaExtension({
      rpcUrl
    })
  }
});

export default function App() {
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userMetadata, setUserMetadata] = useState({});
  const [balance, setBalance] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [sendAmount, setSendAmount] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [sendingTransaction, setSendingTransaction] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const connection = new web3.Connection(rpcUrl);

  useEffect(() => {
    magic.user.isLoggedIn().then(async (magicIsLoggedIn) => {
      setIsLoggedIn(magicIsLoggedIn);
      if (magicIsLoggedIn) {
        magic.user.getMetadata().then((user) => {
          setUserMetadata(user);
          const pubKey = new web3.PublicKey(user.publicAddress);
          getBalance(pubKey);
        });
      }
    });
  }, [isLoggedIn]);

  const login = async () => {
    await magic.auth.loginWithMagicLink({ email });
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await magic.user.logout();
    setIsLoggedIn(false);
  };

  const getBalance = async (pubKey) => {
    connection.getBalance(pubKey).then((bal) => setBalance(bal / 1000000000));
  };

  const requestSol = async () => {
    setDisabled(true);
    const pubKey = new web3.PublicKey(userMetadata.publicAddress);
    const airdropSignature = await connection.requestAirdrop(
      pubKey,
      web3.LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(airdropSignature);
    getBalance(pubKey);
    setDisabled(false);
  };

  const handleSendTransaction = async () => {
    setSendingTransaction(true);
    const recipientPubKey = new web3.PublicKey(destinationAddress);
    const payer = new web3.PublicKey(userMetadata.publicAddress);

    const hash = await connection.getRecentBlockhash();

    let transactionMagic = new web3.Transaction({
      feePayer: payer,
      recentBlockhash: hash.blockhash
    });

    const transaction = web3.SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipientPubKey,
      lamports: sendAmount
    });

    transactionMagic.add(...[transaction]);

    const serializeConfig = {
      requireAllSignatures: false,
      verifySignatures: true
    };

    const signedTransaction = await magic.solana.signTransaction(
      transactionMagic,
      serializeConfig
    );

    console.log("Signed transaction", signedTransaction);

    const tx = web3.Transaction.from(signedTransaction.rawTransaction);
    const signature = await connection.sendRawTransaction(tx.serialize());
    setTxHash(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    setSendingTransaction(false);
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <div className="container">
          <h1>Please sign up or login</h1>
          <input
            type="email"
            name="email"
            required="required"
            placeholder="Enter your email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <button onClick={login}>Send</button>
        </div>
      ) : (
        <div>
          <div className="container">
            <h1>Current user: {userMetadata.email}</h1>
            <button onClick={logout}>Logout</button>
          </div>
          <div className="container">
            <h1>Solana address</h1>
            <div className="info">{userMetadata.publicAddress}</div>
          </div>
          <div className="container">
            <h1>Solana Balance</h1>
            <div className="info">{balance} SOL</div>
            <button onClick={requestSol} disabled={disabled}>
              Get 1 Test SOL
            </button>
            {disabled && <div>Requesting airdrop...</div>}
          </div>
          <div className="container">
            <h1>Send Transaction</h1>
            {txHash ? (
              <div>
                <div>Send transaction success</div>
                <div className="info">{txHash}</div>
              </div>
            ) : sendingTransaction ? (
              <div className="sending-status">Sending transaction</div>
            ) : (
              <div />
            )}
            <input
              type="text"
              name="destination"
              className="full-width"
              required="required"
              placeholder="Destination address"
              onChange={(event) => {
                setDestinationAddress(event.target.value);
              }}
            />
            <input
              type="text"
              name="amount"
              className="full-width"
              required="required"
              placeholder="Amount in LAMPORTS"
              onChange={(event) => {
                setSendAmount(event.target.value);
              }}
            />
            <button id="btn-send-txn" onClick={handleSendTransaction}>
              Sign & Send Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
