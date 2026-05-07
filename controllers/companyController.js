// backend/controllers/companyController.js
const User = require("../models/User");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  }
});

const updateCompanyDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.companyDetails = { ...user.companyDetails, ...req.body.companyDetails };
    await user.save();
    res.json({ msg: "Company details updated", companyDetails: user.companyDetails });
  } catch (err) {
    res.status(500).json({ msg: "Error updating company details" });
  }
};

const getCompanyDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("companyDetails name email");
    res.json({ companyDetails: user.companyDetails || {}, userName: user.name, userEmail: user.email });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching company details" });
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
    const base64Logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const user = await User.findById(req.user.id);
    user.companyDetails.logo = base64Logo;
    await user.save();
    res.json({ msg: "Logo uploaded", logo: user.companyDetails.logo });
  } catch (err) {
    res.status(500).json({ msg: "Error uploading logo" });
  }
};

const deleteLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.companyDetails.logo = null;
    await user.save();
    res.json({ msg: "Logo deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting logo" });
  }
};

module.exports = { updateCompanyDetails, getCompanyDetails, uploadLogo, deleteLogo, upload };